from django.db import models
from django.conf import settings
from booking.models import Booking

class Payout(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("PAID", "Paid"),
        ("FAILED", "Failed"),
    )
    
    TYPE_CHOICES = (
        ("OWNER_RENT", "Owner Rent + Penalty"),
        ("RENTER_REFUND", "Manual Renter Refund"),
    )

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payouts")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    payout_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    
    razorpay_payout_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.payout_type} - {self.amount} ({self.status})"
