from celery import shared_task
from django.utils import timezone
from .models import Booking
from payments.services import refund_payment, transfer_to_owner


@shared_task
def auto_cancel_bookings():
    bookings = Booking.objects.filter(
        status="OWNER_PENDING",
        owner_deadline__lt=timezone.now()
    )

    from payments.services import void_payment

    for booking in bookings:
        if booking.razorpay_payment_id:
            try:
                void_payment(booking.razorpay_payment_id)
            except Exception as e:
                # Log error in real world
                pass

        booking.status = "AUTO_CANCELLED"
        booking.is_settled = True
        booking.save()

@shared_task
def activate_bookings():
    today = timezone.now().date()
    bookings = Booking.objects.filter(
        status="APPROVED",
        start_date__lte=today
    )

    for booking in bookings:
        booking.status = "ACTIVE"
        booking.save()


@shared_task
def settle_returned_bookings():
    # Background settlement for return requested bookings
    bookings = Booking.objects.filter(
        status="RETURN_REQUESTED",
        is_settled=False
    )

    from payments.services import capture_payment
    from payments.models import Payout

    for booking in bookings:
        # For background settlement, we assume 0 penalty unless already set
        capture_amount = float(booking.total_rent + booking.commission) + float(booking.penalty_deducted)
        
        try:
            capture_payment(booking.razorpay_payment_id, capture_amount)
            
            owner_payout_amount = float(booking.total_rent - booking.commission) + float(booking.penalty_deducted)
            
            Payout.objects.create(
                booking=booking,
                amount=owner_payout_amount,
                recipient=booking.asset.owner,
                status="PENDING",
                payout_type="OWNER_RENT"
            )

            booking.status = "COMPLETED"
            booking.is_settled = True
            booking.save()
        except Exception as e:
            # Log error
            pass
