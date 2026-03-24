import api from "./axios";

// start chat
export const startChat = (assetId) =>
  api.post(`start/${assetId}/`);

// send message (text or location)
export const sendMessage = (
  conversationId,
  text = "",
  latitude = null,
  longitude = null
) =>
  api.post("send/", {
    conversation_id: conversationId,
    text: text,
    latitude: latitude,
    longitude: longitude,
  });


export const getMessages = (conversationId) =>
  api.get(`messages/${conversationId}/`);


export const getConversations = () =>
  api.get("conversations/");

// Fetch a single conversation if the backend supports it; otherwise fall back to list lookup.
export const getConversationDetails = async (conversationId) => {
  try {
    const res = await api.get(`conversations/${conversationId}/`);
    return res.data;
  } catch (err) {
    const status = err?.response?.status;
    if (status !== 404 && status !== 405) throw err;

    const res = await getConversations();
    const list = Array.isArray(res.data) ? res.data : res.data?.results;
    if (!Array.isArray(list)) return null;
    return list.find((c) => String(c?.id) === String(conversationId)) || null;
  }
};

// Mark a conversation's incoming messages as read for the current user.
// Backend implementations vary; try a few common endpoint shapes.
let markReadImpl = null;
let markReadUnsupported = false;
export const markConversationRead = async (conversationId) => {
  if (markReadUnsupported) return null;
  if (markReadImpl) return await markReadImpl(conversationId);

  const attempts = [
    // Common DRF custom action patterns (collection actions)
    (id) => api.post("conversations/mark-read/", { conversation_id: id }),
    (id) => api.post("conversations/mark_read/", { conversation_id: id }),

    (id) => api.post("mark-read/", { conversation_id: id }),
    (id) => api.post("mark_read/", { conversation_id: id }),
    (id) => api.post(`conversations/${id}/read/`),
    (id) => api.post(`conversations/${id}/mark-read/`),
    (id) => api.post(`conversations/${id}/mark_read/`),
    (id) => api.post(`messages/${id}/read/`),
    (id) => api.post(`messages/${id}/mark-read/`),
    (id) => api.post(`messages/${id}/mark_read/`),
  ];

  for (const attempt of attempts) {
    try {
      const res = await attempt(conversationId);
      markReadImpl = attempt;
      return res;
    } catch (err) {
      const status = err?.response?.status;
      // If the endpoint doesn't exist or method isn't allowed, try the next shape.
      if (status === 404 || status === 405) {
        continue;
      }

      throw err;
    }
  }

  // No compatible endpoint found; keep app functional.
  markReadUnsupported = true;
  return null;
};
