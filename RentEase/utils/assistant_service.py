import logging
import os
from collections import Counter
import json
import urllib.error
import urllib.request

from django.contrib.auth import get_user_model
from django.db.models import Q

from assets.models import Asset
from booking.models import Booking
from chat.models import Message
from notifications.models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def _user_profile_context(user):
    profile = getattr(user, "profile", None)
    if not profile:
        return {"profile_exists": False}

    panchayat = getattr(profile, "panchayat", None)
    taluk = getattr(panchayat, "taluk", None) if panchayat else None
    district = getattr(taluk, "district", None) if taluk else None

    return {
        "profile_exists": True,
        "is_completed": bool(profile.is_completed),
        "verification_status": profile.verification_status,
        "rejection_reason": profile.rejection_reason or "",
        "panchayat": getattr(panchayat, "name", None),
        "taluk": getattr(taluk, "name", None),
        "district": getattr(district, "name", None),
    }


def _booking_context(user):
    qs = Booking.objects.filter(renter=user).select_related("asset").order_by("-created_at")
    counts = Counter(qs.values_list("status", flat=True))
    latest = [
        {
            "asset_title": b.asset.title if b.asset_id else "",
            "status": b.status,
            "start_date": str(b.start_date),
            "end_date": str(b.end_date),
        }
        for b in qs[:5]
    ]
    return {
        "count": qs.count(),
        "status_counts": dict(counts),
        "latest": latest,
    }


def _asset_context(user):
    own_assets = Asset.objects.filter(owner=user).select_related("category").order_by("-created_at")
    own_latest = [
        {
            "title": a.title,
            "category": a.category.name if a.category_id else None,
            "price_per_day": float(a.price_per_day),
        }
        for a in own_assets[:5]
    ]

    profile = getattr(user, "profile", None)
    panchayat = getattr(profile, "panchayat", None) if profile else None
    city_qs = Asset.objects.exclude(owner=user)
    if panchayat:
        city_qs = city_qs.filter(city=panchayat)

    city_count = city_qs.count()
    city_latest = [
        {
            "title": a.title,
            "price_per_day": float(a.price_per_day),
            "owner": a.owner.name or a.owner.email,
        }
        for a in city_qs.select_related("owner").order_by("price_per_day")[:8]
    ]

    return {
        "own_count": own_assets.count(),
        "own_latest": own_latest,
        "city_available_count": city_count,
        "city_sample": city_latest,
    }


def _notification_context(user):
    unread = Notification.objects.filter(user=user, is_read=False).count()
    latest = [
        {"title": n.title, "message": n.message, "event_type": n.event_type}
        for n in Notification.objects.filter(user=user).order_by("-created_at")[:5]
    ]
    return {"unread_count": unread, "latest": latest}


def _location_context(user):
    rows = (
        Message.objects.filter(
            Q(conversation__owner=user) | Q(conversation__renter=user),
            latitude__isnull=False,
            longitude__isnull=False,
        )
        .select_related("sender")
        .order_by("-created_at")[:10]
    )
    latest_locations = [
        {
            "sender": m.sender.name or m.sender.email,
            "latitude": m.latitude,
            "longitude": m.longitude,
            "created_at": m.created_at.isoformat(),
        }
        for m in rows
    ]
    return {"recent_shared_locations": latest_locations}


def _owner_recommendation_context():
    owners = (
        User.objects.filter(role="USER", profile__verification_status="APPROVED")
        .order_by("-trust_score", "-date_joined")
        .distinct()[:8]
    )
    return {
        "top_owners": [
            {
                "name": owner.name or owner.email,
                "trust_score": owner.trust_score,
            }
            for owner in owners
        ]
    }


def _build_context(user):
    return {
        "site_name": "RentEase",
        "current_user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "trust_score": user.trust_score,
            "role": user.role,
        },
        "profile": _user_profile_context(user),
        "bookings": _booking_context(user),
        "assets": _asset_context(user),
        "notifications": _notification_context(user),
        "chat_locations": _location_context(user),
        "recommendations": _owner_recommendation_context(),
    }


def send_message_to_assistant(*, user_id: int, message: str):
    user = User.objects.filter(id=user_id).select_related("profile").first()
    if not user:
        return {"reply": "User not found.", "intent": "error"}

    payload = {
        "user_id": user_id,
        "message": message,
        "context": _build_context(user),
    }

    # DB-context-driven response generation via Groq (no predefined site answers).
    groq_reply, groq_error = _call_groq_direct(message=message, context=payload["context"])
    if groq_reply:
        return {"intent": "assistant_llm", "reply": groq_reply}

    error_map = {
        "missing_api_key": "GROQ_API_KEY is missing in the server environment.",
        "http_401": "Groq authentication failed (401). Check GROQ_API_KEY.",
        "http_403": "Groq authentication failed (403). Check GROQ_API_KEY and access.",
        "http_404": "Groq endpoint not found. Check GROQ_API_URL.",
        "http_429": "Groq rate limit reached. Try again shortly.",
        "network_error": "Could not reach Groq API. Check network access or GROQ_API_URL.",
        "invalid_response": "Groq response was invalid. Try again.",
    }

    return {
        "reply": error_map.get(
            groq_error,
            "Could not generate an AI response. Please verify GROQ_API_KEY, GROQ_MODEL, and GROQ_API_URL, then try again.",
        ),
        "intent": "assistant_llm_error",
    }


def _call_groq_direct(*, message: str, context: dict):
    raw_key = os.environ.get("GROQ_API_KEY", "")
    api_key = raw_key.strip()
    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    api_url = os.environ.get("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions")

    if not api_key:
        logger.warning("Groq API key missing for assistant.")
        return None, "missing_api_key"
    logger.info("Groq key loaded. length=%s last4=%s", len(api_key), api_key[-4:])

    system_prompt = (
        "You are RentEase Assistant for a rental marketplace web app. "
        "Answer only site-related questions using the provided context. "
        "Be concise and practical."
    )

    request_body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({"question": message, "site_context": context})},
        ],
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "RentEase/1.0 (+https://rentease.local)",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            raw = res.read().decode("utf-8")
            data = json.loads(raw)
            return data["choices"][0]["message"]["content"].strip(), None
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8")
        except Exception:
            body = ""
        logger.warning("Groq HTTP error %s. Body: %s", exc.code, body[:500])
        return None, f"http_{exc.code}"
    except urllib.error.URLError as exc:
        logger.warning("Groq network error: %s", exc)
        return None, "network_error"
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.warning("Groq invalid response: %s", exc)
        return None, "invalid_response"
