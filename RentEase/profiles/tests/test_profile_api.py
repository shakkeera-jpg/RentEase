import pytest


@pytest.mark.django_db
def test_profile_requires_auth(api_client):
    res = api_client.get("/api/profile/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_profile_get_returns_data(auth_client, user_profile):
    res = auth_client.get("/api/profile/")
    assert res.status_code == 200
    assert "user_email" in res.data
    assert "profile_photo" in res.data


@pytest.mark.django_db
def test_districts_requires_auth(api_client):
    res = api_client.get("/api/districts/")
    assert res.status_code in (401, 403)
