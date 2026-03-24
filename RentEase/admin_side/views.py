from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework import serializers
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from booking.models import Booking
from booking.serializers import BookingSerializer
from notifications.utils import publish_notification
from payments.services import refund_payment
from profiles.models import UserProfile

from .serializers import AdminUserVerificationSerializer


class VerificationDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


class AdminSettlementSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    asset = serializers.CharField()
    owner = serializers.CharField()
    renter = serializers.CharField()
    deposit = serializers.CharField()
    penalty = serializers.CharField()
    owner_payout = serializers.CharField()
    renter_refund = serializers.CharField()
    owner_bank_name = serializers.CharField()
    owner_account_number = serializers.CharField()


class AdminUserStatusSerializer(serializers.Serializer):
    action = serializers.CharField(required=False, allow_blank=True)
    is_blocked = serializers.BooleanField(required=False)


class PendingVerificationListView(APIView):
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_summary="List pending verification profiles",
        responses={200: AdminUserVerificationSerializer(many=True)}
    )
    def get(self, request):
        pending_profiles = UserProfile.objects.filter(verification_status="PENDING")
        serializer = AdminUserVerificationSerializer(pending_profiles, many=True)
        return Response(serializer.data)


class ApproveRejectVerificationView(APIView):
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_summary="Approve or reject a user's verification",
        manual_parameters=[
            openapi.Parameter("profile_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=VerificationDecisionSerializer,
        responses={200: openapi.Response("Verification updated")}
    )
    def post(self, request, profile_id):
        try:
            profile = UserProfile.objects.get(id=profile_id)
            new_status = request.data.get("status")
            reason = request.data.get("rejection_reason", "")

            if new_status not in ["APPROVED", "REJECTED"]:
                return Response({"error": "Invalid status"}, status=400)

            profile.verification_status = new_status
            profile.rejection_reason = reason
            profile.save()

            if new_status == "APPROVED":
                publish_notification(
                    event_type="VERIFICATION_APPROVED",
                    recipient_id=profile.user_id,
                    title="Verification approved",
                    message="Your identity verification was approved. You can now list and rent products.",
                    metadata={"profile_id": profile.id, "status": new_status},
                )
            else:
                publish_notification(
                    event_type="VERIFICATION_REJECTED",
                    recipient_id=profile.user_id,
                    title="Verification rejected",
                    message="Your identity verification was rejected. Please upload a valid ID again.",
                    metadata={
                        "profile_id": profile.id,
                        "status": new_status,
                        "rejection_reason": reason,
                    },
                )

            return Response({"message": f"User status updated to {new_status}"})
        except UserProfile.DoesNotExist:
            return Response({"error": "Profile not found"}, status=404)


from rest_framework.permissions import IsAdminUser


class AdminSettlementListView(APIView):
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_summary="List bookings awaiting admin settlement",
        responses={200: AdminSettlementSerializer(many=True)}
    )
    def get(self, request):
        bookings = Booking.objects.filter(
            status="ADMIN_SETTLEMENT_PENDING"
        ).select_related("asset", "renter", "payment")

        data = []

        for booking in bookings:
            bank_details = getattr(booking.asset.owner, "bank_details", None)

            data.append(
                {
                    "id": booking.id,
                    "asset": booking.asset.title,
                    "owner": booking.asset.owner.email,
                    "renter": booking.renter.email,
                    "deposit": str(booking.deposit),
                    "penalty": str(booking.penalty_deducted),
                    "owner_payout": str(booking.get_owner_payout()),
                    "renter_refund": str(booking.get_refundable_deposit()),
                    "owner_bank_name": (
                        bank_details.bank_name if bank_details else "Not Added"
                    ),
                    "owner_account_number": (
                        bank_details.account_number if bank_details else "Not Added"
                    ),
                }
            )

        return Response(data)


class AdminSettlementActionView(APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    @swagger_auto_schema(
        operation_summary="Complete admin settlement for a booking",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: openapi.Response("Settlement completed")}
    )
    def post(self, request, booking_id):

        try:
            booking = Booking.objects.select_related("payment").get(id=booking_id)

            if booking.status != "ADMIN_SETTLEMENT_PENDING":
                return Response({"error": "Invalid state"}, status=400)

            refundable = booking.get_refundable_deposit()
            owner_payout = booking.get_owner_payout()

            refund_id = None

            if refundable > 0:

                if not booking.razorpay_payment_id:
                    return Response(
                        {"error": "No Razorpay payment ID found"}, status=400
                    )

                refund = refund_payment(booking.razorpay_payment_id, refundable)

                if refund.get("status") != "processed":
                    return Response(
                        {"error": "Refund failed. Settlement stopped."}, status=400
                    )

                refund_id = refund.get("id")

                payment = booking.payment
                payment.refunded_amount += refundable
                payment.status = (
                    "PARTIALLY_REFUNDED" if refundable < payment.amount else "REFUNDED"
                )
                payment.save()

            booking.status = "COMPLETED"
            booking.is_settled = True
            booking.refund_id = refund_id
            booking.save()

            return Response(
                {
                    "message": "Refund successful. Admin must transfer owner payout manually.",
                    "owner_payout": str(owner_payout),
                    "renter_refund": str(refundable),
                    "refund_id": refund_id,
                }
            )

        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)


class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_summary="List platform users for admin management",
        responses={200: openapi.Response("User list")}
    )
    def get(self, request):
        users = (
            User.objects.all()
            .order_by("-date_joined")
            .values(
                "id",
                "name",
                "email",
                "role",
                "is_active",
                "is_blocked",
                "trust_score",
                "date_joined",
            )
        )
        return Response(list(users))


class AdminUserStatusView(APIView):
    permission_classes = [IsAdminUser]

    @swagger_auto_schema(
        operation_summary="Block or activate a user",
        manual_parameters=[
            openapi.Parameter("user_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=AdminUserStatusSerializer,
        responses={200: openapi.Response("User status updated")}
    )
    def post(self, request, user_id: int):
        user = get_object_or_404(User, id=user_id)

        action = (request.data.get("action") or "").strip().lower()
        if action in {"block", "blocked"}:
            user.is_blocked = True
        elif action in {"activate", "active", "unblock", "unblocked"}:
            user.is_blocked = False
        elif "is_blocked" in request.data:
            user.is_blocked = bool(request.data.get("is_blocked"))
        else:
            return Response(
                {"error": "Provide action=block|activate or is_blocked boolean"},
                status=400,
            )

        user.save(update_fields=["is_blocked"])
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "is_blocked": user.is_blocked,
            }
        )
