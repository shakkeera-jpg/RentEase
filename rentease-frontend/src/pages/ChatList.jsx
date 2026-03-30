import React, { useEffect, useState } from "react";
import { getConversations, getMessages, markConversationRead } from "../api/chatApi";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

const ChatList = () => {
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();

  const formatUserLabel = (value) => {
    if (!value) return "User";
    const s = value.toString().trim();
    if (!s) return "User";
    const at = s.indexOf("@");
    // Hide emails like someone@gmail.com -> someone
    if (at > 0) return s.slice(0, at);
    return s;
  };

  const formatChatTime = (chat) => {
    const raw =
      chat?.last_message_at ||
      chat?.last_message_time ||
      chat?.updated_at ||
      chat?.created_at;

    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const isSameDay =
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate();

    if (isSameDay) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    return date.toLocaleDateString([], { month: "short", day: "2-digit" });
  };

  const normalizeConversations = (data) => {
    const list = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(list)) return [];

    const getTs = (c) => {
      const raw =
        c?.last_message_at ||
        c?.last_message_time ||
        c?.updated_at ||
        c?.created_at;
      const ts = raw ? Date.parse(raw) : NaN;
      return Number.isFinite(ts) ? ts : null;
    };

    const getLastMessageText = (c) =>
      c?.last_message ??
      c?.last_message_text ??
      c?.lastMessage ??
      c?.lastMessageText ??
      c?.last_message_obj?.text ??
      c?.last_message_obj?.message ??
      c?.last_message_obj?.content ??
      c?.last_message_details?.text ??
      c?.last_message_details?.message ??
      "";

    const isNewer = (a, b) => {
      const ta = getTs(a);
      const tb = getTs(b);
      const aHasText = !!getLastMessageText(a);
      const bHasText = !!getLastMessageText(b);
      if (aHasText !== bHasText) return aHasText;
      if (ta != null && tb != null) return ta > tb;
      if (ta != null && tb == null) return true;
      if (ta == null && tb != null) return false;
      return Number(a?.id ?? 0) > Number(b?.id ?? 0);
    };

    const map = new Map();

    for (const chat of list) {
      const keyRaw =
        chat?.other_user_id ??
        chat?.other_user_username ??
        chat?.other_user_name ??
        chat?.id;
      const key = (keyRaw ?? "").toString().trim().toLowerCase();
      if (!key) continue;

      const unread = Number(chat?.unread_count ?? 0);
      const lastText = getLastMessageText(chat) || chat?.last_message || "";

      if (!map.has(key)) {
        map.set(key, {
          ...chat,
          __mergedConversationIds: [chat.id],
          unread_count: Number.isFinite(unread) ? unread : 0,
          last_message: lastText,
        });
        continue;
      }

      const existing = map.get(key);
      existing.__mergedConversationIds.push(chat.id);
      existing.unread_count += Number.isFinite(unread) ? unread : 0;

      // If the "winner" doesn't have a last message yet, keep it from the other row.
      if (!existing.last_message && lastText) {
        existing.last_message = lastText;
      }

      // Prefer the newest conversation for display/navigation, but keep merged ids + unread sum.
      if (isNewer(chat, existing)) {
        const mergedIds = existing.__mergedConversationIds;
        const totalUnread = existing.unread_count;
        map.set(key, {
          ...chat,
          __mergedConversationIds: mergedIds,
          unread_count: totalUnread,
          last_message: lastText,
        });
      } else {
        map.set(key, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = getTs(a) ?? 0;
      const tb = getTs(b) ?? 0;
      if (ta !== tb) return tb - ta;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });
  };

  const deriveLastMessageFromMessages = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return "";
    const last = messages[messages.length - 1];
    if (!last) return "";
    if (last.latitude && last.longitude) return "Location shared";
    const t = (last.text ?? last.message ?? "").toString();
    return t.trim();
  };

  const hydrateMissingLastMessages = async (normalized) => {
    const toHydrate = normalized
      .filter((c) => !String(c.last_message ?? "").trim())
      .slice(0, 8); // cap so we don't flood the API

    if (toHydrate.length === 0) return;

    // Light concurrency: 2 at a time.
    const queue = [...toHydrate];
    const workers = Array.from({ length: 2 }).map(async () => {
      while (queue.length) {
        const chat = queue.shift();
        if (!chat?.id) continue;
        try {
          const res = await getMessages(chat.id);
          const lastText = deriveLastMessageFromMessages(res.data);
          if (!lastText) continue;
          setConversations((prev) =>
            prev.map((p) => (p.id === chat.id ? { ...p, last_message: lastText } : p))
          );
        } catch {
          // ignore: hydration is best-effort
        }
      }
    });

    await Promise.allSettled(workers);
  };

  const loadChats = async () => {
    try {
      const conversationsRes = await getConversations();
      const normalized = normalizeConversations(conversationsRes.data);
      setConversations(normalized);
      // Best-effort: if backend doesn't provide last_message, derive it.
      hydrateMissingLastMessages(normalized);
    } catch (err) {
      console.error("Failed to load chats", err);
    }
  };

  useEffect(() => {
    loadChats();

    const refresh = () => loadChats();
    window.addEventListener("chat_message", refresh);
    window.addEventListener("realtime_update", refresh);
    window.addEventListener("new_notification", refresh);
    window.addEventListener("focus", refresh);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("chat_message", refresh);
      window.removeEventListener("realtime_update", refresh);
      window.removeEventListener("new_notification", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Messages</h1>
        <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500">{conversations.length} chats</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl divide-y">
        {conversations.map((chat) => (
          <div
            key={chat.id}
            onClick={() => {
              if (Number(chat.unread_count) > 0) {
                setConversations((prev) =>
                  prev.map((p) =>
                    p.id === chat.id ? { ...p, unread_count: 0 } : p
                  )
                );
              }
              // Fire-and-forget so the badge can drop quickly.
              const ids = Array.isArray(chat.__mergedConversationIds) && chat.__mergedConversationIds.length > 0
                ? chat.__mergedConversationIds
                : [chat.id];

              try {
                sessionStorage.setItem(
                  `mergedConversationIds:${chat.id}`,
                  JSON.stringify(ids)
                );
              } catch { }

              Promise.allSettled(ids.map((id) => markConversationRead(id)))
                .then(() => {
                  window.dispatchEvent(new Event("chat_read"));
                  window.dispatchEvent(new Event("realtime_update"));
                })
                .catch(() => {});
              navigate(`/chat/${chat.id}`, {
                state: {
                  mergedConversationIds: ids,
                  otherUserName: chat.other_user_name,
                },
              });
            }}
            className="flex cursor-pointer items-center gap-4 p-4 transition-all hover:bg-teal-50/70"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-sm font-bold text-white">
              {formatUserLabel(chat.other_user_name)?.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{formatUserLabel(chat.other_user_name)}</p>
              <p className="truncate text-sm text-slate-500">
                {String(chat.last_message ?? "").trim() ? chat.last_message : "No messages yet"}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-semibold text-slate-400">{formatChatTime(chat)}</span>
              {Number(chat.unread_count) > 0 ? (
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
                  {Number(chat.unread_count) > 99 ? "99+" : Number(chat.unread_count)}
                </span>
              ) : (
                <MessageCircle size={16} className="text-slate-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
