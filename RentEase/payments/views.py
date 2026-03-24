from decimal import Decimal

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking

from .models import Payment
from .services import create_order, refund_payment, verify_signature


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

        booking = Booking.objects.select_for_update().get(id=booking_id)

        if booking.status != "PAYMENT_PENDING":
            return Response({"error": "Invalid state"}, status=400)

        total_amount = booking.get_total_paid()
        order = create_order(total_amount)

        Payment.objects.create(
            booking=booking, razorpay_order_id=order["id"], amount=total_amount
        )

        booking.razorpay_order_id = order["id"]
        booking.save()

        return Response({"order_id": order["id"], "amount": total_amount})


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
