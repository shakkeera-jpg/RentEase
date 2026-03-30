import json
import os
import requests

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from ai_logic import create_embedding, store_vector, calculate_score, create_collection, search_vector

app = FastAPI()

user_scores = {}


class AssistantChatRequest(BaseModel):
    user_id: int
    message: str
    context: dict = Field(default_factory=dict)


def _fallback_support_reply(message: str):
    lower = message.lower()
    if "payment" in lower:
        return "For payment issues, retry from the booking page and verify your bank/UPI confirmation. If amount was debited without booking confirmation, share details with support."
    if "verification" in lower or "id" in lower:
        return "Go to 'Profile' -> 'Verification', upload your ID, and submit. Browsing is allowed during review, but verified actions need admin approval."
    if "location" in lower or "gps" in lower or "coordinates" in lower:
        return "You can share your location in any personal chat! Open a chat with another user and look for the 'Share Location' option to send or receive real-time coordinates."
    if "chat" in lower or "message" in lower or "talk" in lower:
        return "You can chat with other users directly about assets. Just click the 'Chat' button on any asset or visit your 'Conversations' list to see your personal messages."
    return "I am the RentEase Assistant. I can help with bookings, assets, verification, payments, notifications, location-sharing, and trust-score related questions. What would you like to know?"


def _call_groq(message: str, context: dict):
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("GROK_API_KEY")
    model = os.environ.get("GROQ_MODEL") or os.environ.get("GROK_MODEL", "llama-3.1-8b-instant")
    api_url = os.environ.get("GROQ_API_URL") or os.environ.get(
        "GROK_API_URL", "https://api.groq.com/openai/v1/chat/completions"
    )

    if not api_key:
        return None

    system_prompt = (
        "You are RentEase Assistant, a helpful AI for the RentEase rental marketplace. "
        "Knowledge Base: "
        "- Personal Chat: Users can chat directly about assets. Locate 'Chat' on the asset or in the 'Conversations' menu. "
        "- Location Sharing: In a personal chat, users can click 'Share Location' to send/receive real-time GPS coordinates. "
        "- Verification: Users must upload a valid ID in 'Profile' -> 'Verification' to become verified. "
        "- Bookings: Browse assets, select dates, and send request. Once approved by owner, proceed to payment. "
        "- Payments: We support Razorpay (UPI, Cards, NetBanking) and Cash on Delivery (COD) if enabled by the owner. "
        "- Trust Score: Every user has a trust score that improves with successful transactions and on-time returns. "
        "Guidelines: "
        "- Answer site-related questions based on this knowledge and any provided context. "
        "- If you don't know something specifically about a user's account, guide them to the relevant section (e.g., 'Check your Notifications'). "
        "- Keep replies concise, helpful, and professional."
    )

    # Simplify payload if context is empty
    if not context:
        content = message
    else:
        # Include context in a readable format for the model
        content = f"User Message: {message}\n\nSite Context: {json.dumps(context)}"

    request_body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content},
        ],
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        print(f"Calling Groq API: {api_url} with model {model}")
        response = requests.post(api_url, json=request_body, headers=headers, timeout=25)
        
        if response.status_code != 200:
            print(f"Groq API Error Status: {response.status_code}")
            print(f"Groq API Error Response: {response.text}")
            return None
            
        data = response.json()
        reply = data["choices"][0]["message"]["content"].strip()
        print(f"Groq API success. Reply length: {len(reply)}")
        return reply
    except Exception as e:
        print(f"Groq API General Error: {type(e).__name__} - {str(e)}")
        return None


@app.on_event("startup")
def startup():
    # Ensure Qdrant collection exists
    create_collection()


@app.get("/")
def home():
    return {"message": "AI service running"}


@app.get("/health")
def health():
    return {"status": "AI service healthy"}


@app.post("/transaction")
def process_transaction(data: dict):

    user_id = data.get("user_id")
    transaction_id = data.get("transaction_id")

    if user_id is None or transaction_id is None:
        raise HTTPException(status_code=400, detail="user_id and transaction_id required")

    if "current_score" not in data:
        data["current_score"] = user_scores.get(user_id, 800)

    embedding = create_embedding(data)

    store_vector(
        user_id,
        transaction_id,
        embedding
    )

    score = calculate_score(data)

    user_scores[user_id] = score

    return {
        "user_id": user_id,
        "trust_score": score
    }


@app.get("/user-score/{user_id}")
def get_score(user_id: int):

    score = user_scores.get(user_id, 800)

    return {
        "user_id": user_id,
        "trust_score": score
    }


@app.post("/assistant/chat")
def assistant_chat(payload: AssistantChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    # 1. Embed query for RAG
    query_embedding = create_embedding(message)

    # 2. Search for relevant user history
    relevant_history = []
    try:
        relevant_history = search_vector(payload.user_id, query_embedding, limit=3)
    except Exception as e:
        print(f"RAG Search Error: {e}")

    # 3. Combine contexts
    full_context = payload.context or {}
    if relevant_history:
        full_context["user_history_from_db"] = relevant_history

    # 4. Call Groq
    llm_reply = _call_groq(message, full_context)
    if llm_reply:
        return {"intent": "assistant_llm", "reply": llm_reply}

    return {
        "intent": "support_question",
        "reply": _fallback_support_reply(message),
    }
