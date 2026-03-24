from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from payments.services import refund_payment

from utils.ai_service import send_transaction_to_ai

from .models import Booking


# ✅ 1. Auto Cancel If Owner Doesn't Approve In 24 Hours
@shared_task
def auto_cancel_bookings():

    expired_bookings = Booking.objects.filter(
        status="OWNER_PENDING", owner_deadline__lt=timezone.now(), is_settled=False
    )

    for booking in expired_bookings:
        try:
            with transaction.atomic():

                if booking.razorpay_payment_id:
                    refund_payment(booking.razorpay_payment_id)

                # Update payment record
                payment = booking.payment
                payment.status = "REFUNDED"
                payment.refunded_amount = payment.amount
                payment.save()

                booking.status = "AUTO_CANCELLED"
                booking.is_settled = True
                booking.save()

        except Exception as e:
            print(f"Auto cancel failed for booking {booking.id}: {str(e)}")


@shared_task
def activate_bookings():

    today = timezone.now().date()

    bookings = Booking.objects.filter(status="APPROVED", start_date__lte=today)

    for booking in bookings:
        booking.status = "ACTIVE"
        booking.save()


@shared_task
def update_renter_trust_score_for_settlement(booking_id: int):

    booking = (
        Booking.objects.select_related("renter")
        .only("id", "penalty_deducted", "deposit", "renter__id", "renter__trust_score")
        .get(id=booking_id)
    )

    renter = booking.renter

    payload = {
        "event_type": "SETTLEMENT",
        "user_id": renter.id,
        "transaction_id": f"booking:{booking.id}:settlement",
        "current_score": renter.trust_score,
        "penalty_amount": float(booking.penalty_deducted),
        "deposit_amount": float(booking.deposit),
        "damage_report": bool(
            booking.penalty_deducted and booking.penalty_deducted > 0
        ),
    }

    result = send_transaction_to_ai(payload)
    if not result:
        return

    new_score = result.get("trust_score")
    if isinstance(new_score, int) and new_score != renter.trust_score:
        renter.trust_score = new_score
        renter.save(update_fields=["trust_score"])
