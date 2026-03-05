from django.db import models
from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser, PermissionsMixin, BaseUserManager
)
from django.utils import timezone
import pyotp


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "ADMIN")
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=32, blank=True, null=True)

    def generate_mfa_secret(self):
        self.mfa_secret = pyotp.random_base32()
        self.save()

    def get_totp_uri(self):
        return pyotp.totp.TOTP(self.mfa_secret).provisioning_uri(
            name=self.email,
            issuer_name="RentEase"
        )

    ROLE_CHOICES = (
        ("USER", "User"),
        ("ADMIN", "Admin"),
    )

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)

    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="USER"
    )

    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    has_agreed_terms = models.BooleanField(default=False)
    is_otp_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"

    def __str__(self):
        return self.email


class OTP(models.Model):
    PURPOSE_CHOICES = (
        ("EMAIL_VERIFY", "Email Verification"),
        ("PASSWORD_RESET", "Password Reset"),
        ("ADMIN_LOGIN", "Admin Login"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_hash = models.CharField(max_length=255)
    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)


class DeviceFingerprint(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    fingerprint = models.CharField(max_length=255, db_index=True)
    is_blocked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.fingerprint}"