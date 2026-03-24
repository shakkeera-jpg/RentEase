import pyotp
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import OTP, User
from accounts.views import hash_otp


@pytest.mark.django_db
def test_register_view_creates_user_and_otp():
    client = APIClient()

    url = reverse("register")
    data = {
        "name": "Test User",
        "email": "new@test.com",
        "password": "StrongPass123",
        "confirm_password": "StrongPass123",
        "fingerprint": "device123",
    }

    response = client.post(url, data)

    assert response.status_code == 201
    assert User.objects.count() == 1
    assert OTP.objects.count() == 1


@pytest.mark.django_db
def test_login_success():
    client = APIClient()

    user = User.objects.create_user(
        email="login@test.com",
        password="StrongPass123",
        name="Login User",
        is_active=True,
    )

    url = reverse("login")

    data = {
        "email": "login@test.com",
        "password": "StrongPass123",
        "fingerprint": "device123",
    }

    response = client.post(url, data)

    assert response.status_code == 200
    assert "tokens" in response.data or "agreement_required" in response.data


@pytest.mark.django_db
def test_email_otp_verification():
    client = APIClient()

    user = User.objects.create_user(
        email="otp@test.com", password="123456", name="OTP User"
    )

    raw_otp = "123456"

    OTP.objects.create(user=user, otp_hash=hash_otp(raw_otp), purpose="EMAIL_VERIFY")

    url = reverse("verify-email-otp")

    response = client.post(url, {"email": user.email, "otp": raw_otp})

    assert response.status_code == 200

    user.refresh_from_db()
    assert user.is_active is True


@pytest.mark.django_db
def test_forgot_password():
    client = APIClient()

    user = User.objects.create_user(
        email="reset@test.com", password="123456", name="Reset User", is_active=True
    )

    url = reverse("forgot-password")

    response = client.post(url, {"email": user.email})

    assert response.status_code == 200
    assert OTP.objects.filter(purpose="PASSWORD_RESET").exists()


@pytest.mark.django_db
def test_mfa_verification():
    client = APIClient()

    user = User.objects.create_user(
        email="mfa@test.com", password="123456", name="MFA User", is_active=True
    )

    user.generate_mfa_secret()

    totp = pyotp.TOTP(user.mfa_secret)
    otp = totp.now()

    url = reverse("verify-mfa-login")

    response = client.post(url, {"email": user.email, "otp": otp})
    print(response.status_code)
    print(response.data)

    assert response.status_code == 200
