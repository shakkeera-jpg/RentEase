from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from assets.models import Asset


class Booking(models.Model):

    STATUS_CHOICES = (
        ("PAYMENT_PENDING", "Payment Pending"),
        ("OWNER_PENDING", "Waiting Owner Approval"),
        ("APPROVED", "Approved"),
        ("DELIVERED", "Delivered to Renter"),
        ("RETURN_REQUESTED", "Return Requested"),
        ("ACTIVE", "Active"),
        ("COMPLETED", "Completed"),
        ("REJECTED", "Rejected"),
        ("AUTO_CANCELLED", "Auto Cancelled"),
        ("CANCELLED", "Cancelled by Renter"),
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
        max_length=30,
        choices=STATUS_CHOICES,
        default="PAYMENT_PENDING"
    )

    owner_deadline = models.DateTimeField(null=True, blank=True)

    razorpay_order_id = models.CharField(max_length=255, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=255, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=255, null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    
    delivered_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    
    is_settled = models.BooleanField(default=False)
    penalty_deducted = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)

    

    def set_owner_deadline(self):
        self.owner_deadline = timezone.now() + timedelta(hours=24)
        self.save(update_fields=["owner_deadline"])

    def is_owner_deadline_expired(self):
        return self.owner_deadline and timezone.now() > self.owner_deadline

    def get_total_paid(self):
        return self.total_rent + self.deposit + self.commission

    def get_owner_amount(self):
        
        return self.total_rent - self.commission

    def get_refundable_deposit(self):
       
        return self.deposit - self.penalty_deducted