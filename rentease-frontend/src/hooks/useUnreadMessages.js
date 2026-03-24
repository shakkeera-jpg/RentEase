import { useEffect, useState } from "react";
import api from "../api/axios";
import { getConversations } from "../api/chatApi";

// Single shared poller so Navbar + Sidebar don't create multiple intervals.
let sharedIntervalId = null;
let sharedListenerCount = 0;
let sharedInFlight = null;
let sharedBlockedUntil = 0;
let sharedLastToken = null;
let sharedLastValue = 0;
let sharedPreferConversations = false;
const sharedSubscribers = new Set();
const sharedRefreshEvents = [
  "chat_message",
  "realtime_update",
  "new_notification",
  "chat_read",
  "storage",
];
let sharedEventsAttached = false;
let sharedRefreshHandler = null;

const publish = (nextCount) => {
  sharedLastValue = nextCount;
  for (const fn of sharedSubscribers) fn(nextCount);
};

export default function useUnreadMessages() {

  const [count, setCount] = useState(0);

  const parseUnreadCount = (data) => {
    if (data == null) return null;
    if (typeof data === "number") return Number.isFinite(data) ? data : null;
    if (typeof data === "string") {
      const n = Number(data);
      return Number.isFinite(n) ? n : null;
    }

    if (Array.isArray(data)) {
      const sum = data.reduce((acc, item) => {
        const n = Number(
          item?.unread_count ?? item?.unreadCount ?? item?.unread ?? item?.count ?? 0
        );
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      return Number.isFinite(sum) ? sum : null;
    }

    if (typeof data === "object") {
      const n = Number(
        data?.count ??
          data?.unread_count ??
          data?.unreadCount ??
          data?.unread ??
          data?.total ??
          0
      );
      return Number.isFinite(n) ? n : null;
    }

    return null;
  };

  const loadUnreadFromConversations = async () => {
    const res = await getConversations();
    // Support either a plain list or a paginated shape.
    const list = Array.isArray(res.data) ? res.data : res.data?.results;
    const parsed = parseUnreadCount(list);
    if (parsed != null) publish(parsed);
    return parsed;
  };

  const loadUnread = async () => {
    try {
      if (typeof document !== "undefined" && document.hidden) return;

      const token = localStorage.getItem("access");
      if (!token) {
        sharedBlockedUntil = 0;
        sharedLastToken = null;
        publish(0);
        return;
      }

      // If token changed (login/logout/refresh), clear any backoff.
      if (sharedLastToken !== token) {
        sharedLastToken = token;
        sharedBlockedUntil = 0;
      }

      if (Date.now() < sharedBlockedUntil) return;
      if (sharedInFlight) return sharedInFlight;

      sharedInFlight = (async () => {
      // If we've observed that unread-count is unreliable, use conversations as source of truth.
      if (sharedPreferConversations) {
        await loadUnreadFromConversations();
        return null;
      }

      const res = await api.get("messages/unread-count/");

      const parsed = parseUnreadCount(res?.data);
      if (parsed != null) {
        // If unread-count says 0 but conversations says otherwise, trust conversations and stop
        // calling unread-count to avoid showing an incorrect 0.
        if (parsed === 0) {
          const convCount = await loadUnreadFromConversations();
          if (typeof convCount === "number" && convCount > 0) {
            sharedPreferConversations = true;
            return convCount;
          }
        } else {
          publish(parsed);
        }

        return parsed;
      }

      // If the endpoint exists but has an unexpected shape, fall back.
      await loadUnreadFromConversations();
      return null;
      })();

      return await sharedInFlight;
    } catch (err) {
      const status = err?.response?.status;
      // Avoid hammering the API when credentials expire.
      if (status === 401 || status === 403) {
        sharedBlockedUntil = Date.now() + 30_000;
      }

      console.error(err);
      try {
        await loadUnreadFromConversations();
      } catch (fallbackErr) {
        const fallbackStatus = fallbackErr?.response?.status;
        if (fallbackStatus === 401 || fallbackStatus === 403) {
          sharedBlockedUntil = Date.now() + 30_000;
        }
        console.error(fallbackErr);
      }
    } finally {
      sharedInFlight = null;
    }
  };

  useEffect(() => {

    sharedListenerCount += 1;
    const subscriber = (next) => setCount(next);
    sharedSubscribers.add(subscriber);
    // Push the latest known value immediately so badges render without waiting for polling.
    setCount(sharedLastValue);

    // Initial fetch and start polling once.
    loadUnread();
    // Keep a slow poll as a fallback in case realtime events are missed.
    if (!sharedIntervalId) sharedIntervalId = setInterval(loadUnread, 60_000);

    if (!sharedEventsAttached) {
      sharedEventsAttached = true;
      sharedRefreshHandler = () => loadUnread();
      for (const evt of sharedRefreshEvents) window.addEventListener(evt, sharedRefreshHandler);
    }

    return () => {
      sharedListenerCount -= 1;
      sharedSubscribers.delete(subscriber);

      // If no components are using the hook, stop the timer.
      if (sharedListenerCount <= 0) {
        sharedListenerCount = 0;
        if (sharedIntervalId) clearInterval(sharedIntervalId);
        sharedIntervalId = null;
        sharedInFlight = null;
        sharedBlockedUntil = 0;
        sharedLastToken = null;
        sharedSubscribers.clear();
        if (sharedEventsAttached && sharedRefreshHandler) {
          for (const evt of sharedRefreshEvents) {
            window.removeEventListener(evt, sharedRefreshHandler);
          }
        }
        sharedEventsAttached = false;
        sharedRefreshHandler = null;
      }
    };

  }, []);

  return count;
}
