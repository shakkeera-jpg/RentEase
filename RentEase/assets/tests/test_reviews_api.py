from datetime import date, timedelta
from decimal import Decimal

import pytest

from assets.models import Asset, Category, AssetReview
from booking.models import Booking


@pytest.mark.django_db
def test_asset_reviews_list_public(api_client, other_user, panchayat):
    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Asset With Reviews",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )

    res = api_client.get(f"/api/assets/{asset.id}/reviews/")
    assert res.status_code == 200
    assert res.data == []


@pytest.mark.django_db
def test_create_review_requires_auth(api_client, user, other_user, panchayat):
    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Review Asset",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )
    booking = Booking.objects.create(
        asset=asset,
        renter=user,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=2),
        total_rent=Decimal("10.00"),
        deposit=Decimal("0.00"),
        commission=Decimal("1.00"),
        status="RETURN_REQUESTED",
    )

    res = api_client.post(
        f"/api/bookings/{booking.id}/review/",
        {"rating": 5, "feedback": "Great"},
        format="json",
    )
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_create_review_success_and_unique(auth_client, user, other_user, panchayat):
    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Review Asset 2",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="0.00",
    )
    booking = Booking.objects.create(
        asset=asset,
        renter=user,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=2),
        total_rent=Decimal("10.00"),
        deposit=Decimal("0.00"),
        commission=Decimal("1.00"),
        status="RETURN_REQUESTED",
    )

    res = auth_client.post(
        f"/api/bookings/{booking.id}/review/",
        {"rating": 4, "feedback": "Nice"},
        format="json",
    )
    assert res.status_code == 201
    assert AssetReview.objects.filter(booking=booking).exists()

    res2 = auth_client.post(
        f"/api/bookings/{booking.id}/review/", {"rating": 5}, format="json"
    )
    assert res2.status_code == 400
