import pytest


@pytest.mark.django_db
def test_notifications_requires_auth(api_client):
    res = api_client.get("/api/unread-count/")
    assert res.status_code in (401, 403)
