import pytest

from profiles.models import UserProfile


@pytest.mark.django_db
def test_admin_pending_requires_admin(auth_client):
    res = auth_client.get("/api/pending/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_admin_pending_returns_list_for_admin(admin_client, user, panchayat):
    # Create a pending profile
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={"phone": "9999999999", "address": "X", "panchayat": panchayat},
    )
    profile.verification_status = "PENDING"
    profile.save(update_fields=["verification_status"])

    res = admin_client.get("/api/pending/")
    assert res.status_code == 200
    assert isinstance(res.data, list)
