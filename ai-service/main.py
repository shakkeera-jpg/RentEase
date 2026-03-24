from fastapi import FastAPI, HTTPException
from ai_logic import create_embedding, store_vector, calculate_score, create_collection

app = FastAPI()

user_scores = {}


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
