from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


class District(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Taluk(models.Model):
    district = models.ForeignKey(
        District, on_delete=models.CASCADE, related_name="taluks"
    )
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ("district", "name")

    def __str__(self):
        return f"{self.name} ({self.district.name})"


class Panchayat(models.Model):
    taluk = models.ForeignKey(
        Taluk, on_delete=models.CASCADE, related_name="panchayats"
    )
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ("taluk", "name")

    def __str__(self):
        return f"{self.name} - {self.taluk.name}"


class UserProfile(models.Model):

    VERIFICATION_STATUS = (
        ("NOT_SUBMITTED", "Not Submitted"),
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    panchayat = models.ForeignKey(
        Panchayat,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    phone = models.CharField(max_length=15)
    address = models.TextField()
    is_completed = models.BooleanField(default=False)

    id_document = models.FileField(
        upload_to="verification_docs/", null=True, blank=True
    )

    profile_photo = models.ImageField(
        upload_to="profile_photos/", null=True, blank=True
    )

    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUS, default="NOT_SUBMITTED"
    )

    rejection_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def district(self):
        if self.panchayat:
            return self.panchayat.taluk.district
        return None

    @property
    def taluk(self):
        if self.panchayat:
            return self.panchayat.taluk
        return None

    def __str__(self):
        return f"{self.user.email} Profile"
