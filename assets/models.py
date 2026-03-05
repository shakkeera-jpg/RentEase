from django.db import models
from django.conf import settings
from profiles.models import Panchayat

User = settings.AUTH_USER_MODEL


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Asset(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assets"
    )
    asset_image = models.ImageField(
        upload_to="asset_image/",
        null=True,
        blank=True
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name="assets"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    city = models.ForeignKey(Panchayat, on_delete=models.SET_NULL, null=True,)
    price_per_day = models.DecimalField(max_digits=10, decimal_places=2)
    deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class AssetAvailability(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="availability"
    )
    available_from = models.DateField()
    available_to = models.DateField()

    def __str__(self):
        return f"{self.asset.title} ({self.available_from} - {self.available_to})"


class RentalRequest(models.Model):

    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    )

    asset = models.ForeignKey(
        "Asset",  
        on_delete=models.CASCADE,
        related_name="rental_requests"
    )

    renter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_requests"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("asset", "renter")  

    def __str__(self):
        return f"{self.asset.title} - {self.renter.name} ({self.status})"


class Review(models.Model):
    REVIEW_TYPE_CHOICES = (
        ("OWNER_REVIEW", "Review of Owner"),
        ("RENTER_REVIEW", "Review of Renter"),
    )

    booking = models.ForeignKey(
        "booking.Booking",
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews_given"
    )
    reviewee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reviews_received"
    )
    rating = models.PositiveSmallIntegerField()  # 1-5
    comment = models.TextField(blank=True)
    review_type = models.CharField(max_length=20, choices=REVIEW_TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("booking", "reviewer", "review_type")

    def __str__(self):
        return f"Review by {self.reviewer.name} for {self.reviewee.name} ({self.rating}/5)"

