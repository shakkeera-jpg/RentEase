import pytest

from accounts.models import User
from accounts.serializers import RegisterSerializer


@pytest.mark.django_db
def test_register_serializer_valid():
    data = {
        "name": "Test",
        "email": "test@gmail.com",
        "password": "StrongPass123",
        "confirm_password": "StrongPass123",
        "fingerprint": "abc123",
    }

    serializer = RegisterSerializer(data=data)
    assert serializer.is_valid()


@pytest.mark.django_db
def test_register_serializer_password_mismatch():
    data = {
        "name": "Test",
        "email": "test@gmail.com",
        "password": "123456",
        "confirm_password": "wrongpass",
        "fingerprint": "abc123",
    }

    serializer = RegisterSerializer(data=data)
    assert not serializer.is_valid()
