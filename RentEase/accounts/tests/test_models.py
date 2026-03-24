import pytest
from django.contrib.auth import get_user_model

from accounts.models import OTP, DeviceFingerprint

User = get_user_model()


@pytest.mark.django_db
def test_user_creation():
    user = User.objects.create_user(
        email="test@test.com", password="StrongPass123", name="Test User"
    )

    assert user.email == "test@test.com"
    assert user.check_password("StrongPass123")
    assert user.is_active is False


@pytest.mark.django_db
def test_otp_creation():
    user = User.objects.create_user(
        email="otp@test.com", password="123456", name="OTP User"
    )

    otp = OTP.objects.create(user=user, otp_hash="dummyhash", purpose="EMAIL_VERIFY")

    assert otp.user == user
    assert otp.is_used is False


@pytest.mark.django_db
def test_device_fingerprint_creation():
    user = User.objects.create_user(
        email="device@test.com", password="123456", name="Device User"
    )

    device = DeviceFingerprint.objects.create(user=user, fingerprint="abc123")

    assert device.user == user
    assert device.is_blocked is False
