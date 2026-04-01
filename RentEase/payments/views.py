import logging
from decimal import Decimal

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from razorpay.errors import BadRequestError, GatewayError, ServerError

from booking.models import Booking

from .models import Payment
from .services import create_order, refund_payment, verify_signature

logger = logging.getLogger(__name__)


class VerifyPaymentSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class CreatePaymentView(APIView):

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Create a Razorpay payment order for a booking",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: openapi.Response("Payment order created")}
    )
    def post(self, request, booking_id):

        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        if booking.status != "PAYMENT_PENDING":
            return Response({"error": "Invalid state"}, status=400)

        total_amount = booking.get_total_paid()
        if total_amount <= 0:
            return Response({"error": "Amount must be greater than zero"}, status=400)

        # Idempotency: if a payment order already exists for this booking, reuse it.
        try:
            existing_payment = booking.payment
        except Payment.DoesNotExist:
            existing_payment = None

        if existing_payment:
            order_id = booking.razorpay_order_id or existing_payment.razorpay_order_id
            if order_id:
                amount_paise = int(
                    (existing_payment.amount * Decimal("100")).quantize(Decimal("1"))
                )
                return Response({"order_id": order_id, "amount": amount_paise})

        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            logger.error("Razorpay keys are missing in server environment.")
            return Response(
                {"error": "Razorpay is not configured on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            order = create_order(total_amount)
        except (BadRequestError, GatewayError, ServerError) as exc:
            logger.exception("Razorpay order creation failed: %s", exc)
            payload = {"error": "Razorpay order creation failed."}
            if settings.DEBUG:
                payload["details"] = str(exc)
            return Response(payload, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as exc:
            logger.exception("Unexpected error while creating Razorpay order: %s", exc)
            payload = {"error": "Unable to create Razorpay order."}
            if settings.DEBUG:
                payload["details"] = str(exc)
            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            Payment.objects.create(
                booking=booking, razorpay_order_id=order["id"], amount=total_amount
            )
        except IntegrityError:
            # Another request created the payment concurrently. Reuse it.
            existing_payment = Payment.objects.get(booking=booking)
            amount_paise = int((existing_payment.amount * Decimal("100")).quantize(Decimal("1")))
            return Response({"order_id": existing_payment.razorpay_order_id, "amount": amount_paise})

        booking.razorpay_order_id = order["id"]
        booking.save()

        return Response({"order_id": order["id"], "amount": order.get("amount")})


class VerifyPaymentView(APIView):

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Verify Razorpay payment signature",
        request_body=VerifyPaymentSerializer,
        responses={200: openapi.Response("Payment verified")}
    )
    def post(self, request):

        data = request.data

        booking = Booking.objects.get(razorpay_order_id=data["razorpay_order_id"])
        if booking.status != "PAYMENT_PENDING":
            return Response({"error": "Invalid state"}, status=400)

        verify_signature(data)

        booking.razorpay_payment_id = data["razorpay_payment_id"]
        booking.status = "OWNER_PENDING"
        booking.paid_at = timezone.now()
        booking.set_owner_deadline()
        booking.save()

        payment = booking.payment
        payment.razorpay_payment_id = data["razorpay_payment_id"]
        payment.status = "PAID"
        payment.save()

        return Response({"message": "Payment Verified"})
