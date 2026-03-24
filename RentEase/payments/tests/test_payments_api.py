from datetime import date, timedelta
from decimal import Decimal

import pytest

from booking.models import Booking
from payments.models import Payment


@pytest.mark.django_db
def test_create_payment_creates_order(monkeypatch, user, other_user, panchayat):
    # Patch Razorpay integration
    monkeypatch.setattr(
        "payments.views.create_order", lambda amount: {"id": "order_test_123"}
    )

    # Minimal booking in PAYMENT_PENDING state
    from assets.models import Asset, Category

    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Pay Asset",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="5.00",
    )

    booking = Booking.objects.create(
        asset=asset,
        renter=user,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=2),
        total_rent=Decimal("10.00"),
        deposit=Decimal("5.00"),
        commission=Decimal("1.00"),
        status="PAYMENT_PENDING",
    )

    from rest_framework.test import APIClient

    client = APIClient()
    res = client.post(f"/api/payment/create/{booking.id}/", {}, format="json")
    assert res.status_code == 200
    assert res.data["order_id"] == "order_test_123"
    assert Payment.objects.filter(
        booking=booking, razorpay_order_id="order_test_123"
    ).exists()


@pytest.mark.django_db
def test_verify_payment_updates_booking(monkeypatch, user, other_user, panchayat):
    monkeypatch.setattr("payments.views.verify_signature", lambda data: None)

    from assets.models import Asset, Category

    category = Category.objects.create(name="Tools")
    asset = Asset.objects.create(
        owner=other_user,
        category=category,
        title="Pay Asset 2",
        description="Desc",
        city=panchayat,
        price_per_day="10.00",
        deposit="5.00",
    )

    booking = Booking.objects.create(
        asset=asset,
        renter=user,
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=2),
        total_rent=Decimal("10.00"),
        deposit=Decimal("5.00"),
        commission=Decimal("1.00"),
        status="PAYMENT_PENDING",
        razorpay_order_id="order_test_456",
    )

    Payment.objects.create(
        booking=booking,
        razorpay_order_id="order_test_456",
        amount=booking.get_total_paid(),
    )

    from rest_framework.test import APIClient

    client = APIClient()
    res = client.post(
        "/api/payment/verify/",
        {
            "razorpay_order_id": "order_test_456",
            "razorpay_payment_id": "pay_test_1",
            "razorpay_signature": "sig_test",
        },
        format="json",
    )
    assert res.status_code == 200

    booking.refresh_from_db()
    assert booking.status == "OWNER_PENDING"
    assert booking.razorpay_payment_id == "pay_test_1"
