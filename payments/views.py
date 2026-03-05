from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from booking.models import Booking
from django.utils import timezone
from .services import create_order, verify_signature


class CreatePaymentView(APIView):

    def post(self, request, booking_id):

        booking = Booking.objects.get(id=booking_id)

        if booking.status != "PAYMENT_PENDING":
            return Response({"error": "Invalid state"}, status=400)

        total_amount = (
            booking.total_rent +
            booking.deposit +
            booking.commission
        )

        order = create_order(total_amount)

        booking.razorpay_order_id = order["id"]
        booking.save()

        return Response({
            "order_id": order["id"],
            "amount": total_amount
        })


class VerifyPaymentView(APIView):

    def post(self, request):

        data = request.data

        booking = Booking.objects.get(
            razorpay_order_id=data["razorpay_order_id"]
        )

        verify_signature(data)

        booking.razorpay_payment_id = data["razorpay_payment_id"]
        booking.razorpay_signature = data["razorpay_signature"]
        booking.status = "OWNER_PENDING"
        booking.paid_at = timezone.now()
        booking.set_owner_deadline()
        booking.save()

        return Response({"message": "Payment Verified"})