from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from assets.models import Asset


class Booking(models.Model):

    STATUS_CHOICES = (
        ("PAYMENT_PENDING", "Payment Pending"),
        ("OWNER_PENDING", "Waiting Owner Approval"),
        ("APPROVED", "Approved"),
        ("ACTIVE", "Active"),
        ("RETURN_REQUESTED", "Return Requested"),
        ("ADMIN_SETTLEMENT_PENDING", "Admin Settlement Pending"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
        ("AUTO_CANCELLED", "Auto Cancelled"),
        ("REFUNDED", "Refunded"),
    )

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    renter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    start_date = models.DateField()
    end_date = models.DateField()

    total_rent = models.DecimalField(max_digits=10, decimal_places=2)
    deposit = models.DecimalField(max_digits=10, decimal_places=2)
    commission = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=30, choices=STATUS_CHOICES, default="PAYMENT_PENDING"
    )

    owner_deadline = models.DateTimeField(null=True, blank=True)

    razorpay_order_id = models.CharField(max_length=255, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=255, null=True, blank=True)

    paid_at = models.DateTimeField(null=True, blank=True)

    penalty_deducted = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )

    is_settled = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def set_owner_deadline(self):
        self.owner_deadline = timezone.now() + timedelta(hours=24)
        self.save(update_fields=["owner_deadline"])

    def get_total_paid(self):
        return self.total_rent + self.deposit + self.commission

    def get_owner_payout(self):
        return self.total_rent - self.commission + self.penalty_deducted

    def get_refundable_deposit(self):
        refundable = self.deposit - self.penalty_deducted
        return refundable if refundable > 0 else Decimal("0.00")
