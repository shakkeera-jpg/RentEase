import logging
from django.apps import apps
from django.db.models.signals import post_save
from django.dispatch import receiver
from .ai_service import send_transaction_to_ai

logger = logging.getLogger(__name__)

def index_asset(instance):
    payload = {
        "event_type": "ASSET_UPDATE",
        "user_id": instance.owner.id,
        "transaction_id": f"asset:{instance.id}",
        "data": {
            "title": instance.title,
            "description": instance.description,
            "category": instance.category.name if instance.category else "Uncategorized",
            "price_per_day": float(instance.price_per_day),
            "deposit": float(instance.deposit),
            "city": instance.city.name if instance.city else "Unknown",
        }
    }
    send_transaction_to_ai(payload)

def index_booking(instance):
    payload = {
        "event_type": "BOOKING_UPDATE",
        "user_id": instance.renter.id,
        "transaction_id": f"booking:{instance.id}",
        "data": {
            "asset_title": instance.asset.title,
            "status": instance.status,
            "start_date": str(instance.start_date),
            "end_date": str(instance.end_date),
            "total_rent": float(instance.total_rent),
            "deposit": float(instance.deposit),
            "commission": float(instance.commission),
        }
    }
    send_transaction_to_ai(payload)

Asset = apps.get_model("assets", "Asset")
Booking = apps.get_model("booking", "Booking")


@receiver(post_save, sender=Asset)
def asset_saved(sender, instance, **kwargs):
    try:
        index_asset(instance)
    except Exception as e:
        logger.warning(f"Failed to index asset {instance.id}: {e}")


@receiver(post_save, sender=Booking)
def booking_saved(sender, instance, **kwargs):
    try:
        index_booking(instance)
    except Exception as e:
        logger.warning(f"Failed to index booking {instance.id}: {e}")
