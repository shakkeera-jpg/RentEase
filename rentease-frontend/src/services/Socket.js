let socket = null;
let reconnectTimer = null;
let lastConnectParam = null;

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)) % 4, "="));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const connectSocket = (userIdOrToken) => {
  lastConnectParam = userIdOrToken;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  let userId = userIdOrToken;
  if (typeof userIdOrToken === "string" && userIdOrToken.includes(".")) {
    const payload = decodeJwtPayload(userIdOrToken);
    userId = payload?.user_id || payload?.id || payload?.sub || userIdOrToken;
  }

  const currentIdentifiers = new Set(
    [
      localStorage.getItem("username"),
      localStorage.getItem("email"),
      localStorage.getItem("name"),
      localStorage.getItem("admin_email"),
    ]
      .filter(Boolean)
      .map((v) => v.toString().trim().toLowerCase())
      .filter(Boolean)
  );

  const isForCurrentUser = (data) => {
    const recipient =
      data?.recipient_username ||
      data?.recipient ||
      data?.target_user ||
      data?.username ||
      "";

    if (!recipient) return true;

    // If we don't know who we are (missing localStorage keys), don't drop events.
    if (currentIdentifiers.size === 0) return true;

    return currentIdentifiers.has(recipient.toString().trim().toLowerCase());
  };

  socket = new WebSocket(
    `wss://w9f7rq37bl.execute-api.eu-north-1.amazonaws.com/dev?user_id=${userId}`
  );

  socket.onopen = () => {
    console.log("Connected to WebSocket");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Realtime message:", data);

    if (data.type === "notification") {
      if (!isForCurrentUser(data)) return;
      window.dispatchEvent(new Event("new_notification"));
      window.dispatchEvent(new Event("realtime_update"));
    }

    if (data.type === "chat") {
      console.log("Chat message:", data.message);
      window.dispatchEvent(new Event("chat_message"));
      window.dispatchEvent(new Event("realtime_update"));
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket closed");
    socket = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (lastConnectParam) connectSocket(lastConnectParam);
    }, 3000);
  };

};

export const disconnectSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

export const sendChatMessage = (message, receiver_id) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({
      action: "sendMessage",
      message: message,
      receiver_id: receiver_id,
    })
  );
};
