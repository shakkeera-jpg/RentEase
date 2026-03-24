from datetime import date, timedelta

import pytest

from assets.models import Asset, Category


@pytest.mark.django_db
def test_create_booking_requires_auth(api_client):
    res = api_client.post(
        "/api/create/",
        {"asset": 1, "start_date": "2099-01-01", "end_date": "2099-01-03"},
    )
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_create_booking_success(
    auth_client, user_profile, other_user, other_user_profile, panchayat, monkeypatch
):
    # Avoid AWS/SQS call inside publish_notification
    monkeypatch.setattr(
        "booking.views.publish_notification", lambda *args, **kwargs: None
    )

    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Test Asset",
        description="Desc",
        city=panchayat,
        price_per_day="100.00",
        deposit="50.00",
    )

    start = date.today() + timedelta(days=1)
    end = start + timedelta(days=2)
    res = auth_client.post(
        "/api/create/",
        {
            "asset": asset.id,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
        format="json",
    )
    assert res.status_code == 201
    assert "booking_id" in res.data
