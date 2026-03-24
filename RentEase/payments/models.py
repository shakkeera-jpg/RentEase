from decimal import Decimal

from django.db import models

from booking.models import Booking


class Payment(models.Model):

    STATUS_CHOICES = (
        ("CREATED", "Created"),
        ("PAID", "Paid"),
        ("PARTIALLY_REFUNDED", "Partially Refunded"),
        ("REFUNDED", "Refunded"),
        ("SETTLED", "Settled"),
    )

    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name="payment"
    )

    razorpay_order_id = models.CharField(max_length=255)
    razorpay_payment_id = models.CharField(max_length=255, null=True, blank=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    refunded_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="CREATED")

    created_at = models.DateTimeField(auto_now_add=True)
