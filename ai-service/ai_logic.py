import uuid

from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Distance, VectorParams

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Connect to Qdrant container
client = QdrantClient(host="qdrant", port=6333)

def _normalize_point_id(transaction_id):
    """
    Qdrant point IDs must be either:
    - an unsigned integer, or
    - a UUID (string).

    RentEase sends `transaction_id` as a readable string (e.g. "booking:57:settlement"),
    so we convert non-integer/non-UUID values to a deterministic UUID.
    """

    if isinstance(transaction_id, int):
        if transaction_id < 0:
            raise ValueError("transaction_id must be an unsigned integer or UUID")
        return transaction_id

    raw = str(transaction_id).strip()
    try:
        uuid.UUID(raw)
        return raw
    except (ValueError, TypeError):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, raw))


def create_collection():
    """
    Ensure collection exists in Qdrant
    """

    collections = client.get_collections().collections

    exists = any(col.name == "user_behavior" for col in collections)

    if not exists:
        client.create_collection(
            collection_name="user_behavior",
            vectors_config=VectorParams(
                size=384,
                distance=Distance.COSINE
            )
        )


def create_embedding(data):
    """
    Convert transaction data into embedding
    """

    text = str(data)

    embedding = model.encode(text)

    return embedding.tolist()


def store_vector(user_id, transaction_id, embedding):
    """
    Store vector in Qdrant
    """

    # Ensure collection exists
    create_collection()

    point_id = _normalize_point_id(transaction_id)

    client.upsert(
        collection_name="user_behavior",
        points=[
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={"user_id": user_id, "transaction_id": str(transaction_id)}
            )
        ]
    )


def calculate_score(data):
    """
    Simple trust score calculation.

    Expected inputs:
    - current_score (optional): starting score (defaults to 800)
    - event_type (optional): e.g. LOGIN, SETTLEMENT
    - late_return (optional): bool
    - damage_report (optional): bool
    - penalty_amount (optional): number
    """

    try:
        score = int(data.get("current_score", 800))
    except (TypeError, ValueError):
        score = 800

    event_type = str(data.get("event_type", "")).upper()
    if event_type == "LOGIN":
        return max(0, min(score, 1000))

    if data.get("late_return"):
        score -= 100

    if data.get("damage_report"):
        score -= 200

    try:
        penalty_amount = float(data.get("penalty_amount", 0) or 0)
    except (TypeError, ValueError):
        penalty_amount = 0

    if penalty_amount > 0:
        score -= 100

    return max(0, min(score, 1000))


def search_vector(user_id, query_embedding, limit=5):
    """
    Search Qdrant for relevant history for a specific user.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    search_result = client.search(
        collection_name="user_behavior",
        query_vector=query_embedding,
        query_filter=Filter(
            must=[
                FieldCondition(key="payload.user_id", match=MatchValue(value=user_id))
            ]
        ),
        limit=limit,
    )
    
    return [hit.payload for hit in search_result]
