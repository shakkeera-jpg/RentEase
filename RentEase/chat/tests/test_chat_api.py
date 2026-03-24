import pytest


@pytest.mark.django_db
def test_message_list_requires_auth(api_client):
    res = api_client.get("/api/messages/1/")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_conversations_requires_auth(api_client):
    res = api_client.get("/api/conversations/")
    assert res.status_code in (401, 403)
