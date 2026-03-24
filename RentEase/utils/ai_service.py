import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_transaction_to_ai(data, *, return_error: bool = False):

    base_url = str(settings.AI_SERVICE_URL).rstrip("/")
    url = f"{base_url}/transaction"

    timeout_seconds = float(getattr(settings, "AI_SERVICE_TIMEOUT_SECONDS", 30))

    try:
        response = requests.post(
            url,
            json=data,
            # (connect timeout, read timeout)
            timeout=(2, timeout_seconds),
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.warning("AI service request failed: %s", exc)
        if return_error:
            return {"_error": str(exc)}
        return None


def get_user_score_from_ai(user_id: int):
    base_url = str(settings.AI_SERVICE_URL).rstrip("/")
    url = f"{base_url}/user-score/{user_id}"

    timeout_seconds = float(getattr(settings, "AI_SERVICE_TIMEOUT_SECONDS", 30))

    try:
        response = requests.get(
            url,
            timeout=(2, timeout_seconds),
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.warning("AI service request failed: %s", exc)
        return None
