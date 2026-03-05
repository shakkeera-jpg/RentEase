import razorpay
from django.conf import settings


def get_razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


def create_order(amount):
    client = get_razorpay_client()
    return client.order.create({
        "amount": int(amount * 100),
        "currency": "INR",
        "payment_capture": 0  # 0 for Manual Capture (Pre-auth)
    })


def verify_signature(data):
    client = get_razorpay_client()
    client.utility.verify_payment_signature(data)


def capture_payment(payment_id, amount):
    client = get_razorpay_client()
    return client.payment.capture(payment_id, int(amount * 100))


def void_payment(payment_id):
    # Razorpay doesn't have a direct 'void' for all methods, 
    # but a full refund on an authorized payment effectively cancels it.
    client = get_razorpay_client()
    return client.payment.refund(payment_id)


def refund_payment(payment_id, amount=None):
    client = get_razorpay_client()

    if amount:
        return client.payment.refund(payment_id, {
            "amount": int(amount * 100)
        })

    return client.payment.refund(payment_id)
