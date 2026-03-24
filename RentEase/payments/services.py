from decimal import Decimal

import razorpay
from django.conf import settings


def get_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


def create_order(amount):
    client = get_client()
    return client.order.create(
        {"amount": int(amount * 100), "currency": "INR", "payment_capture": 1}
    )


def verify_signature(data):
    client = get_client()
    client.utility.verify_payment_signature(data)


def refund_payment(payment_id, amount=None):
    client = get_client()

    if amount:
        return client.payment.refund(payment_id, {"amount": int(Decimal(amount) * 100)})

    return client.payment.refund(payment_id)
