import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Send, MessageCircle, X } from "lucide-react";
import useAuthStore from "../store/authStore";
import { sendAssistantMessage } from "../api/chatApi";

const ASSISTANT_STORAGE_KEY = "assistantConversationMessages";
const ASSISTANT_WELCOME_MESSAGE = {
  id: "assistant-welcome",
  sender: "RentEase Assistant",
  text: "Hi! I can help with verification, bookings, payments, and using RentEase. What do you want to do?",
  created_at: new Date().toISOString(),
};

const formatMessageTime = (msg) => {
  const raw = msg?.created_at || msg?.timestamp;
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const loadStoredMessages = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(ASSISTANT_STORAGE_KEY) || "[]");
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch {
    // ignore corrupted local storage
  }
  return [ASSISTANT_WELCOME_MESSAGE];
};

function ChatWidget() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setMessages(loadStoredMessages());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isOpen]);

  const persistMessages = (next) => {
    setMessages(next);
    localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(next));
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const optimistic = {
      id: `local-${Date.now()}`,
      sender: "You",
      text: trimmed,
      created_at: new Date().toISOString(),
    };

    setText("");
    setSending(true);

    const currentThread = [...messages, optimistic];
    persistMessages(currentThread);

    if (!isAuthenticated) {
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: "RentEase Assistant",
        text: "Please log in to use the assistant.",
        created_at: new Date().toISOString(),
      };
      persistMessages([...currentThread, assistantMessage]);
      setSending(false);
      return;
    }

    try {
      const res = await sendAssistantMessage(optimistic.text);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: "RentEase Assistant",
        text: res.data.reply,
        created_at: new Date().toISOString(),
      };
      persistMessages([...currentThread, assistantMessage]);
    } catch (err) {
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: "RentEase Assistant",
        text: "Assistant service is unavailable right now. Please try again shortly.",
        created_at: new Date().toISOString(),
      };
      persistMessages([...currentThread, assistantMessage]);
    } finally {
      setSending(false);
    }
  };

  const hideOnRoutes = ["/login", "/register"];
  if (hideOnRoutes.includes(location.pathname)) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-[320px] max-w-[85vw] overflow-hidden rounded-3xl border border-white/60 bg-white/30 backdrop-blur-2xl shadow-2xl shadow-emerald-200/50">
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600/95 to-teal-500/85 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">RentEase Assistant</p>
              <p className="text-[11px] opacity-90">Ask anything about the platform</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full bg-white/20 p-1.5 transition hover:bg-white/30"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="h-[320px] space-y-3 overflow-y-auto bg-white/20 px-4 py-3">
            {messages.map((msg) => {
              const isMine = msg.sender === "You";
              const timeLabel = formatMessageTime(msg);
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isMine
                        ? "bg-emerald-500 text-white rounded-br-none"
                        : "bg-white text-slate-800 rounded-bl-none"
                    }`}
                  >
                    <p>{msg.text}</p>
                    {timeLabel && (
                      <div className={`mt-1 text-[10px] font-semibold opacity-70 ${isMine ? "text-white/90" : "text-slate-400"}`}>
                        {timeLabel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-white/50 bg-white/30 px-3 py-3 backdrop-blur-2xl">
            <input
              type="text"
              placeholder="Type your question..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSend}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-200"
            >
              <Send size={14} />
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-300/60 transition hover:-translate-y-0.5"
        >
          <MessageCircle size={18} />
          Chat with Assistant
        </button>
      )}
    </div>
  );
}

export default ChatWidget;
