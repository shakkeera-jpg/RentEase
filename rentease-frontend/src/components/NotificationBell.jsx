import { useEffect, useState, useRef } from "react";
import { onMessage } from "firebase/messaging";
import { messaging } from "../firebase";
import api from "../api/axios";

function NotificationBell() {

  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);
  const token = localStorage.getItem("access");
  const currentName = (localStorage.getItem("name") || "").trim().toLowerCase();
  const isForCurrentUser = (payload) => {
    const recipient =
      payload?.data?.recipient_username ||
      payload?.data?.recipient ||
      payload?.data?.target_user ||
      payload?.data?.username ||
      "";

    if (!recipient) return true;
    return recipient.toString().trim().toLowerCase() === currentName;
  };

  const dispatchRealtimeEvents = (payload) => {
    const eventType = payload?.data?.event_type || "";
    const event = eventType.toUpperCase();

    if (event === "RENT_REQUEST_CREATED") window.dispatchEvent(new Event("new_request"));
    if (event === "RENT_REQUEST_APPROVED") window.dispatchEvent(new Event("request_approved"));
    if (event === "RENT_REQUEST_REJECTED") window.dispatchEvent(new Event("request_rejected"));
    if (event === "CHAT_MESSAGE" || event === "NEW_MESSAGE" || event === "MESSAGE_RECEIVED") {
      window.dispatchEvent(new Event("chat_message"));
    }

    window.dispatchEvent(new Event("realtime_update"));
  };

  
  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const res = await api.get("my/");

      setNotifications(res.data);

    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  };

  useEffect(() => {

    fetchNotifications();

    
    const unsubscribe = onMessage(messaging, (payload) => {
      if (!isForCurrentUser(payload)) return;
      dispatchRealtimeEvents(payload);
      fetchNotifications();
    });

    
    if ("serviceWorker" in navigator) {

      navigator.serviceWorker.addEventListener("message", (event) => {

        if (event.data?.type === "FCM_MESSAGE") {
          if (!isForCurrentUser(event.data.payload)) return;
          dispatchRealtimeEvents(event.data.payload);
          fetchNotifications();

        }
      });
    }

    const handleNotificationEvent = () => {
      fetchNotifications();
    };
    window.addEventListener("new_notification", handleNotificationEvent);

    
    const handleClickOutside = (event) => {

      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }

    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {

      unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("new_notification", handleNotificationEvent);

    };

  }, [token]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleBellClick = async () => {

    setIsOpen(!isOpen);

    if (!isOpen && unreadCount > 0) {

      try {

        await api.post(
          "mark-all-read/",
          {}
        );

        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );

      } catch (err) {
        console.error("Failed to mark read", err);
      }
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>

      {/* Bell Icon */}
      <button
        onClick={handleBellClick}
        className="p-2 text-slate-700 hover:bg-slate-100 rounded-full relative"
      >

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >

          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 
            2.032 0 0118 14.158V11a6.002 
            6.002 0 00-4-5.659V5a2 2 
            0 10-4 0v.341C7.67 6.165 6 
            8.388 6 11v3.159c0 
            .538-.214 1.055-.595 
            1.436L4 17h5m6 0v1a3 
            3 0 11-6 0v-1m6 0H9"
          />

        </svg>

        {unreadCount > 0 && (

          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-white">

            {unreadCount}

          </span>

        )}

      </button>

      {/* Dropdown */}
      {isOpen && (

        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border z-50">

          <div className="p-4 border-b font-bold">
            Notifications
          </div>

          <div className="max-h-72 overflow-y-auto">

            {notifications.length === 0 ? (

              <div className="p-6 text-center text-gray-400">
                No notifications
              </div>

            ) : (

              notifications.map((n) => (

                <div
                  key={n.id}
                  className={`p-4 border-b ${
                    !n.is_read ? "bg-blue-50" : ""
                  }`}
                >

                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-gray-600">{n.message}</p>

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </p>

                </div>

              ))

            )}

          </div>

        </div>

      )}

    </div>
  );
}

export default NotificationBell;
