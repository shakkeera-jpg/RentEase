import logging
from datetime import timedelta
from decimal import Decimal

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from razorpay.errors import BadRequestError
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import DeviceToken
from notifications.utils import publish_notification
from payments.services import refund_payment
from chat.models import Conversation
from utils.ai_service import send_transaction_to_ai
from django.conf import settings
from assets.permissions import IsProfileApproved

from .models import Booking
from .serializers import BookingSerializer, CreateBookingSerializer
from payments.models import Payment

logger = logging.getLogger(__name__)


class BookingActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])


class PenaltySerializer(serializers.Serializer):
    penalty = serializers.DecimalField(max_digits=10, decimal_places=2)


class BookingStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ACTIVE", "RETURN_REQUESTED"])


class OwnerActionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Approve or reject a pending booking",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=BookingActionSerializer,
        responses={200: openapi.Response("Booking action applied")}
    )
    def post(self, request, booking_id):

        booking = get_object_or_404(Booking, id=booking_id)

        if booking.asset.owner != request.user:
            return Response({"error": "Not allowed"}, status=403)

        if booking.status != "OWNER_PENDING":
            return Response({"error": "Invalid booking state"}, status=400)

        action = request.data.get("action")

        if action == "approve":
            booking.status = "APPROVED"
            booking.save()

            renter = booking.renter
            owner = booking.asset.owner

            conversation, created = Conversation.objects.get_or_create(
                asset=booking.asset, owner=booking.asset.owner, renter=renter
            )

            publish_notification(
                event_type="RENT_REQUEST_APPROVED",
                recipient_id=renter.id,
                title="Booking Approved",
                message=f"Your booking for {booking.asset.title} was approved",
            )

            return Response({"message": "Booking approved successfully."})

        elif action == "reject":

            if booking.razorpay_payment_id:
                refund_payment(booking.razorpay_payment_id)

            booking.status = "REFUNDED"
            booking.is_settled = True
            booking.save()

            renter = booking.renter

            publish_notification(
                event_type="RENT_REQUEST_REJECTED",
                recipient_id=renter.id,
                title="Booking Rejected",
                message=f"Your booking for {booking.asset.title} was rejected",
            )

            payment = booking.payment
            payment.status = "REFUNDED"
            payment.refunded_amount = payment.amount
            payment.save()

            return Response({"message": "Booking rejected and fully refunded."})

        return Response({"error": "Invalid action"}, status=400)


class FinalizeReturnView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Finalize a returned booking and send it for admin settlement",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=PenaltySerializer,
        responses={200: openapi.Response("Return finalized")}
    )
    def post(self, request, booking_id):

        booking = Booking.objects.select_related("renter", "asset__owner").get(
            id=booking_id
        )

        if booking.asset.owner != request.user:
            return Response({"error": "Not allowed"}, status=403)

        if booking.status != "RETURN_REQUESTED":
            return Response({"error": "Invalid state"}, status=400)

        penalty = Decimal(request.data.get("penalty", "0"))

        if penalty > booking.deposit:
            return Response({"error": "Penalty cannot exceed deposit"}, status=400)

        booking.penalty_deducted = penalty

        booking.status = "ADMIN_SETTLEMENT_PENDING"
        booking.save()

        # Update renter trust score immediately when owner claims penalty/damage.
        # (This matches the product requirement and avoids needing the admin settlement step.)
        renter = booking.renter
        payload = {
            "event_type": "PENALTY_CLAIMED",
            "user_id": renter.id,
            "transaction_id": f"booking:{booking.id}:penalty_claimed",
            "current_score": renter.trust_score,
            "penalty_amount": float(penalty),
            "deposit_amount": float(booking.deposit),
            "damage_report": bool(penalty and penalty > 0),
        }

        old_score = renter.trust_score
        result = send_transaction_to_ai(
            payload, return_error=getattr(settings, "DEBUG", False)
        )
        logger.info(
            "AI trust score update (booking_id=%s renter_id=%s penalty=%s): old=%s result=%s",
            booking.id,
            renter.id,
            str(penalty),
            old_score,
            result,
        )
        if result and not result.get("_error"):
            new_score = result.get("trust_score")
            if isinstance(new_score, int) and new_score != renter.trust_score:
                renter.trust_score = new_score
                renter.save(update_fields=["trust_score"])

        return Response(
            {
                "message": "Sent to admin for settlement",
                "owner_should_receive": str(booking.get_owner_payout()),
                "renter_refundable": str(booking.get_refundable_deposit()),
                **(
                    {
                        "ai_debug": {
                            "old_score": old_score,
                            "ai_response": result,
                            "new_score": renter.trust_score,
                            "ai_service_url": getattr(settings, "AI_SERVICE_URL", None),
                        }
                    }
                    if getattr(settings, "DEBUG", False)
                    else {}
                ),
            }
        )


class CreateBookingView(APIView):
    permission_classes = [IsAuthenticated, IsProfileApproved]

    @swagger_auto_schema(
        operation_summary="Create a booking request",
        request_body=CreateBookingSerializer,
        responses={201: openapi.Response("Booking created")}
    )
    def post(self, request):

        serializer = CreateBookingSerializer(
            data=request.data, context={"request": request}
        )

        if serializer.is_valid():
            booking = serializer.save()

            owner = booking.asset.owner

            publish_notification(
                event_type="RENT_REQUEST_CREATED",
                recipient_id=owner.id,
                title="New Rent Request",
                message=f"{request.user.name} requested your {booking.asset.title}",
                metadata={"booking_id": booking.id, "asset": booking.asset.title},
            )
            return Response(
                {
                    "message": "Booking created successfully",
                    "booking_id": booking.id,
                    "total_amount_to_pay": booking.get_total_paid(),
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RenterCancelView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Cancel an unpaid or owner-pending booking within the allowed window",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: openapi.Response("Booking cancelled")}
    )
    def post(self, request, booking_id):

        booking = get_object_or_404(
            Booking.objects.select_for_update(),
            id=booking_id,
            renter=request.user,
        )

        # Cancellation allowed only while waiting for owner approval.
        # If the owner approves (status becomes APPROVED), the renter can no longer cancel.
        if booking.status != "OWNER_PENDING":
            return Response(
                {"error": "Booking cannot be cancelled at this stage."}, status=400
            )

        if not booking.paid_at:
            return Response({"error": "Payment not completed."}, status=400)

        try:
            payment = Payment.objects.select_for_update().get(booking=booking)
        except Payment.DoesNotExist:
            return Response({"error": "No payment found for refund."}, status=400)

        if not payment.razorpay_payment_id:
            return Response({"error": "No payment found for refund."}, status=400)

        time_elapsed = timezone.now() - booking.paid_at
        if time_elapsed > timedelta(hours=24):
            return Response({"error": "Cancellation window expired."}, status=400)

        refund_amount = booking.get_total_paid()

        # Idempotency: if Razorpay already refunded (or we already recorded full refund),
        # do not call the Razorpay API again.
        already_fully_refunded = bool(
            payment.status == "REFUNDED" and payment.refunded_amount >= payment.amount
        )
        if not already_fully_refunded:
            try:
                refund_payment(payment.razorpay_payment_id, refund_amount)
            except BadRequestError as exc:
                if "fully refunded already" not in str(exc).lower():
                    return Response({"error": str(exc)}, status=400)

        payment.refunded_amount = payment.amount
        payment.status = "REFUNDED"

        payment.save()

        booking.status = "CANCELLED"
        booking.is_settled = True
        booking.save()

        return Response(
            {
                "message": "Booking cancelled successfully.",
                "refund_amount": str(refund_amount),
                "already_refunded": already_fully_refunded,
            }
        )


class MyRentalsView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List current user's rentals",
        responses={200: BookingSerializer(many=True)}
    )
    def get(self, request):
        user_rentals = (
            Booking.objects.filter(renter=request.user)
            .select_related("asset", "asset__owner")
            .order_by("-created_at")
        )
        serializer = BookingSerializer(user_rentals, many=True)
        return Response(serializer.data)


class UpdateBookingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Update renter booking status",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=BookingStatusUpdateSerializer,
        responses={200: openapi.Response("Booking status updated")}
    )
    def post(self, request, booking_id):

        booking = get_object_or_404(Booking, id=booking_id, renter=request.user)
        new_status = request.data.get("status")

        if booking.status == "APPROVED" and new_status == "ACTIVE":
            booking.status = "ACTIVE"
            message = "Product marked as Received. Rental period has started."
        elif booking.status == "ACTIVE" and new_status == "RETURN_REQUESTED":
            booking.status = "RETURN_REQUESTED"
            message = "Product marked as Returned. Waiting for owner to finalize."
        else:
            return Response(
                {"error": f"Illegal status move from {booking.status} to {new_status}"},
                status=400,
            )

        booking.save()
        return Response({"message": message, "status": booking.status})
