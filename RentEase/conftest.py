import pytest
from rest_framework.test import APIClient

from accounts.models import User
from profiles.models import District, Taluk, Panchayat, UserProfile


@pytest.fixture()
def api_client():
    return APIClient()


@pytest.fixture()
def user(db):
    return User.objects.create_user(
        email="user@test.com",
        password="StrongPass123",
        name="Test User",
        is_active=True,
    )


@pytest.fixture()
def other_user(db):
    return User.objects.create_user(
        email="other@test.com",
        password="StrongPass123",
        name="Other User",
        is_active=True,
    )


@pytest.fixture()
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture()
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@test.com",
        password="StrongPass123",
        name="Admin User",
    )


@pytest.fixture()
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture()
def panchayat(db):
    district = District.objects.create(name="Test District")
    taluk = Taluk.objects.create(name="Test Taluk", district=district)
    return Panchayat.objects.create(name="Test Panchayat", taluk=taluk)


@pytest.fixture()
def user_profile(db, user, panchayat):
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "phone": "9999999999",
            "address": "Test Address",
            "panchayat": panchayat,
            "verification_status": "APPROVED",
            "is_completed": True,
        },
    )
    if not profile.phone:
        profile.phone = "9999999999"
    if not profile.address:
        profile.address = "Test Address"
    if profile.panchayat_id is None:
        profile.panchayat = panchayat
    if profile.verification_status != "APPROVED":
        profile.verification_status = "APPROVED"
    if not profile.is_completed:
        profile.is_completed = True
    profile.save()
    return profile


@pytest.fixture()
def other_user_profile(db, other_user, panchayat):
    profile, _ = UserProfile.objects.get_or_create(
        user=other_user,
        defaults={
            "phone": "8888888888",
            "address": "Other Address",
            "panchayat": panchayat,
            "verification_status": "APPROVED",
            "is_completed": True,
        },
    )
    if not profile.phone:
        profile.phone = "8888888888"
    if not profile.address:
        profile.address = "Other Address"
    if profile.panchayat_id is None:
        profile.panchayat = panchayat
    if profile.verification_status != "APPROVED":
        profile.verification_status = "APPROVED"
    if not profile.is_completed:
        profile.is_completed = True
    profile.save()
    return profile
