import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getConversationDetails, getMessages, markConversationRead, sendMessage } from "../api/chatApi";
import { MapPin, Send } from "lucide-react";

function ChatPage() {
  const { conversationId } = useParams();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState(location?.state?.otherUserName || "");

  const currentUser = localStorage.getItem("username") || localStorage.getItem("name");

  const formatUserLabel = (value) => {
    if (!value) return "User";
    const s = value.toString().trim();
    if (!s) return "User";
    const at = s.indexOf("@");
    if (at > 0) return s.slice(0, at);
    return s;
  };

  const formatMessageTime = (msg) => {
    const raw =
      msg?.created_at ||
      msg?.sent_at ||
      msg?.timestamp ||
      msg?.time;

    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const loadConversationMeta = async () => {
    // Prefer navigation state; fall back to API lookup.
    const fromState = location?.state?.otherUserName;
    if (fromState) {
      setOtherUserName(fromState);
      return;
    }

    try {
      const details = await getConversationDetails(conversationId);
      if (details?.other_user_name) setOtherUserName(details.other_user_name);
    } catch (err) {
      // Non-blocking
    }
  };


  const sendLocation = () => {

    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      await sendMessage(conversationId, "", latitude, longitude);

      loadMessages();

    }, (err) => {
      console.error("Geolocation error:", err);
      alert(err?.message || "Failed to get current location");
    }, {
      // Reduce stale / IP-based results when possible.
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  };

  const loadMessages = async () => {
    try {
      const res = await getMessages(conversationId);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const markRead = async () => {
    try {
      const mergedIdsFromState = location?.state?.mergedConversationIds;
      let ids =
        Array.isArray(mergedIdsFromState) && mergedIdsFromState.length > 0
          ? mergedIdsFromState
          : null;

      if (!ids) {
        try {
          const raw = sessionStorage.getItem(`mergedConversationIds:${conversationId}`);
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed) && parsed.length > 0) ids = parsed;
        } catch { }
      }

      if (!ids) ids = [conversationId];

      // If the backend accidentally created multiple threads for the same pair,
      // clear unread in all of them so the badge can drop to 0.
      const results = await Promise.allSettled(ids.map((id) => markConversationRead(id)));
      const anySupported = results.some(
        (r) => r.status === "fulfilled" && r.value != null
      );

      // Some backends mark messages as read when the messages list is fetched,
      // but only for that conversation. If we have merged ids and no explicit
      // mark-read endpoint, fetch the other thread(s) once to clear server unread.
      if (!anySupported && ids.length > 1) {
        await Promise.allSettled(
          ids
            .filter((id) => String(id) !== String(conversationId))
            .map((id) => getMessages(id))
        );
      }

      window.dispatchEvent(new Event("chat_read"));
      window.dispatchEvent(new Event("realtime_update"));
    } catch (err) {
      console.error("Failed to mark conversation as read", err);
    }
  };

  useEffect(() => {
    loadConversationMeta();
    loadMessages();
    markRead();

    const refresh = () => loadMessages();

    window.addEventListener("chat_message", refresh);
    window.addEventListener("realtime_update", refresh);

    return () => {
      window.removeEventListener("chat_message", refresh);
      window.removeEventListener("realtime_update", refresh);
    };
  }, [conversationId]);

  useEffect(() => {
    const onFocus = () => {
      loadMessages();
      markRead();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [conversationId]);

  const handleSend = async () => {
    if (!text.trim()) return;

    const optimistic = {
      id: `local-${Date.now()}`,
      sender: currentUser,
      text: text,
    };

    try {
      setSending(true);
      setMessages((prev) => [...prev, optimistic]);
      await sendMessage(conversationId, text);

      setText("");
      loadMessages();
      window.dispatchEvent(new Event("chat_message"));
    } catch (error) {
      console.error("Send message error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="mb-4 text-2xl font-extrabold text-slate-900">
        {String(otherUserName || "").trim()
          ? formatUserLabel(otherUserName)
          : "Chat"}
      </h2>

      <div className="glass h-[460px] overflow-y-auto rounded-2xl p-4">
        {messages.map((msg) => {
          const isMine = msg.sender === currentUser;
          const timeLabel = formatMessageTime(msg);

          return (
            <div
              key={msg.id}
              className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${isMine
                    ? "bg-emerald-500 text-white rounded-br-none"
                    : "bg-white text-slate-800 rounded-bl-none"
                  }`}
              >
                {/* LOCATION OR TEXT MESSAGE */}
                {msg.latitude && msg.longitude ? (
                  <a
                    href={`https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    📍 View Location
                  </a>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}

                {timeLabel && (
                  <div className={`mt-1 text-[11px] font-semibold opacity-70 ${isMine ? "text-white/90" : "text-slate-400"}`}>
                    {timeLabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="Type message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
        />

        <button onClick={handleSend} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-emerald-200">
          <Send size={15} />
          {sending ? "Sending..." : "Send"}
        </button>

        <button
          onClick={sendLocation}
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-teal-600 bg-white px-5 py-3 text-sm font-semibold text-teal-700 transition-all hover:bg-teal-50 active:scale-[0.98]"
        >
          <MapPin size={15} />
          Send Location
        </button>

      </div>
    </div>
  );
}

export default ChatPage;
