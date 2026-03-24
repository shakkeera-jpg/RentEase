import base64
import hashlib
import io
import logging
import random
import time
from smtplib import SMTPException

import pyotp
import qrcode
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.utils import timezone
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from google.auth.transport import requests
from google.oauth2 import id_token
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from accounts.models import OTP, DeviceFingerprint, User
from accounts.serializers import (
    AdminOTPVerifySerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
)
from accounts.utils import get_tokens_for_user

from .models import OwnerBankDetails
from .serializers import OwnerBankDetailsSerializer
from .tasks import send_otp_email

logger = logging.getLogger(__name__)

User = get_user_model()


class EmailOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)


class AcceptAgreementSerializer(serializers.Serializer):
    email = serializers.EmailField()


class GoogleLoginSerializer(serializers.Serializer):
    token = serializers.CharField()


class MFASetupVerifySerializer(serializers.Serializer):
    otp = serializers.CharField(max_length=6)


class DocumentedTokenRefreshView(TokenRefreshView):
    @swagger_auto_schema(
        operation_summary="Refresh JWT access token",
        request_body=TokenRefreshSerializer,
        responses={200: openapi.Response("Access token refreshed")},
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


def generate_otp():
    return str(random.randint(100000, 999999))


def hash_otp(otp):
    return hashlib.sha256(otp.encode()).hexdigest()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        request_body=RegisterSerializer, responses={201: "OTP sent to your email"}
    )
    def post(self, request):
        start = time.time()
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        otp = generate_otp()

        OTP.objects.create(user=user, otp_hash=hash_otp(otp), purpose="EMAIL_VERIFY")
        send_otp_email.delay(user.email, otp)
        return Response(
            {
                "name": user.name,
                "message": "OTP sent to your email",
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailOTPView(APIView):
    permission_classes = []

    @swagger_auto_schema(
        operation_summary="Verify registration email OTP",
        request_body=EmailOTPSerializer,
        responses={200: openapi.Response("Email verified")}
    )
    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        if not email or not otp:
            return Response(
                {"error": "Email and OTP required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj = OTP.objects.filter(
            user=user, purpose="EMAIL_VERIFY", is_used=False
        ).last()

        if not otp_obj:
            return Response(
                {"error": "OTP not found or already used"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() - otp_obj.created_at > timezone.timedelta(minutes=5):
            return Response(
                {"error": "OTP expired"}, status=status.HTTP_400_BAD_REQUEST
            )

        if hash_otp(otp) != otp_obj.otp_hash:
            return Response(
                {"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj.is_used = True
        otp_obj.save()

        user.is_active = True
        user.save()

        return Response(
            {"message": "Email verified successfully"}, status=status.HTTP_200_OK
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="Login user or admin",
        request_body=LoginSerializer,
        responses={200: openapi.Response("Login response")}
    )
    def post(self, request):
        fingerprint = request.data.get("fingerprint")
        blocked = DeviceFingerprint.objects.filter(
            fingerprint=fingerprint, is_blocked=True
        ).exists()

        if blocked:
            return Response(
                {"error": "Device blocked"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        if user.role == "USER":
            if not user.has_agreed_terms:
                return Response(
                    {"agreement_required": True, "email": user.email},
                    status=status.HTTP_200_OK,
                )

            if user.mfa_enabled:

                return Response(
                    {
                        "message": "MFA required",
                        "role": "USER",
                        "mfa_required": True,
                        "mfa_enabled": True,
                        "email": user.email,
                    },
                    status=status.HTTP_200_OK,
                )

            tokens = get_tokens_for_user(user)
            return Response(
                {
                    "message": "Login successful",
                    "role": "USER",
                    "name": user.name,
                    "email": user.email,
                    "tokens": tokens,
                    "trust_score": user.trust_score,
                },
                status=status.HTTP_200_OK,
            )

        if user.role == "ADMIN":

            if user.is_otp_verified:
                tokens = get_tokens_for_user(user)
                return Response(
                    {
                        "message": "Admin login successful",
                        "role": "ADMIN",
                        "name": user.name,
                        "email": user.email,
                        "tokens": tokens,
                        "otp_required": False,
                        "trust_score": user.trust_score,
                    },
                    status=status.HTTP_200_OK,
                )

            otp = generate_otp()
            OTP.objects.create(user=user, otp_hash=hash_otp(otp), purpose="ADMIN_LOGIN")

            try:
                send_mail(
                    subject="RentEase Admin Login OTP",
                    message=f"Your admin login OTP is {otp}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except SMTPException:
                logger.exception("Failed to send admin login OTP email")
                return Response(
                    {
                        "error": "Unable to send admin login OTP email. Check email settings and try again."
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            return Response(
                {
                    "message": "OTP sent to admin email",
                    "role": "ADMIN",
                    "otp_required": True,
                    "email": user.email,
                },
                status=status.HTTP_200_OK,
            )

        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)


class AdminOTPVerifyView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="Verify admin login OTP",
        request_body=AdminOTPVerifySerializer,
        responses={200: openapi.Response("Admin authenticated")}
    )
    def post(self, request):
        serializer = AdminOTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]

        try:
            user = User.objects.get(email=email, role="ADMIN")
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid admin email"}, status=status.HTTP_400_BAD_REQUEST
            )

        if getattr(user, "is_blocked", False):
            return Response({"error": "Account is blocked"}, status=403)

        otp_obj = OTP.objects.filter(
            user=user, purpose="ADMIN_LOGIN", is_used=False
        ).last()

        if not otp_obj:
            return Response(
                {"error": "OTP not found"}, status=status.HTTP_400_BAD_REQUEST
            )

        if timezone.now() - otp_obj.created_at > timezone.timedelta(minutes=5):
            return Response(
                {"error": "OTP expired"}, status=status.HTTP_400_BAD_REQUEST
            )

        if hash_otp(otp) != otp_obj.otp_hash:
            return Response(
                {"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj.is_used = True
        otp_obj.save()

        user.is_otp_verified = True
        user.save()

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "message": "Admin login successful",
                "role": "ADMIN",
                "name": user.name,
                "email": user.email,
                "tokens": tokens,
            },
            status=status.HTTP_200_OK,
        )


class AcceptAgreementView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="Accept terms and complete login",
        request_body=AcceptAgreementSerializer,
        responses={200: openapi.Response("Agreement accepted")}
    )
    def post(self, request):
        email = request.data.get("email")
        user = User.objects.get(email=email)

        if getattr(user, "is_blocked", False):
            return Response({"error": "Account is blocked"}, status=403)

        user.has_agreed_terms = True
        user.save()

        tokens = get_tokens_for_user(user)
        return Response(
            {
                "message": "Agreement accepted and logged in",
                "tokens": tokens,
                "role": "USER",
            },
            status=status.HTTP_200_OK,
        )


class ForgotPasswordView(APIView):
    permission_classes = []

    @swagger_auto_schema(
        operation_summary="Request password reset OTP",
        request_body=ForgotPasswordSerializer,
        responses={200: openapi.Response("Reset OTP sent")}
    )
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.get(email=email)

        otp = generate_otp()

        OTP.objects.create(user=user, otp_hash=hash_otp(otp), purpose="PASSWORD_RESET")

        send_mail(
            subject="RentEase Password Reset OTP",
            message=f"Your password reset OTP is {otp}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"message": "OTP sent to your email"}, status=status.HTTP_200_OK
        )


class ResetPasswordView(APIView):
    permission_classes = []

    @swagger_auto_schema(
        operation_summary="Reset password with OTP",
        request_body=ResetPasswordSerializer,
        responses={200: openapi.Response("Password reset")}
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST
            )

        otp_obj = OTP.objects.filter(
            user=user, purpose="PASSWORD_RESET", is_used=False
        ).last()

        if not otp_obj:
            return Response(
                {"error": "OTP not found"}, status=status.HTTP_400_BAD_REQUEST
            )

        if timezone.now() - otp_obj.created_at > timezone.timedelta(minutes=5):
            return Response(
                {"error": "OTP expired"}, status=status.HTTP_400_BAD_REQUEST
            )

        if hash_otp(otp) != otp_obj.otp_hash:
            return Response(
                {"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        otp_obj.is_used = True
        otp_obj.save()

        return Response(
            {"message": "Password reset successful"}, status=status.HTTP_200_OK
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Logout current user",
        responses={200: openapi.Response("Logout successful")}
    )
    def post(self, request):
        return Response(
            {"message": "Logged out successfully"}, status=status.HTTP_200_OK
        )


@swagger_auto_schema(
    method="post",
    operation_summary="Login with Google token",
    request_body=GoogleLoginSerializer,
    responses={200: openapi.Response("Google login response")},
)
@api_view(["POST"])
def google_login(request):
    token = request.data.get("token")

    if not token:
        return Response({"error": "Token missing"}, status=400)

    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), settings.GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "name": name,
                "is_active": True,
            },
        )

        if getattr(user, "is_blocked", False):
            return Response({"error": "Account is blocked"}, status=403)

        if user.mfa_enabled:
            return Response(
                {
                    "message": "MFA required",
                    "mfa_required": True,
                    "email": user.email,
                },
                status=status.HTTP_200_OK,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful",
                "role": user.role,
                "name": user.name,
                "email": user.email,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
                "trust_score": user.trust_score,
            }
        )

    except ValueError:
        return Response({"error": "Invalid token"}, status=400)


@swagger_auto_schema(
    method="post",
    operation_summary="Generate MFA QR code",
    responses={200: openapi.Response("Base64 encoded QR code")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_mfa_qr(request):
    user = request.user

    if not user.mfa_secret:
        user.generate_mfa_secret()

    uri = user.get_totp_uri()

    qr = qrcode.make(uri)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")

    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return Response({"qr_code": qr_base64})


@swagger_auto_schema(
    method="post",
    operation_summary="Verify MFA setup code",
    request_body=MFASetupVerifySerializer,
    responses={200: openapi.Response("MFA enabled")},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_mfa(request):
    user = request.user
    otp = request.data.get("otp")

    totp = pyotp.TOTP(user.mfa_secret)

    if totp.verify(otp):
        user.mfa_enabled = True
        user.save()
        return Response({"message": "MFA Enabled"})
    else:
        return Response({"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)


class UserMFAVerifyView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="Verify user MFA login code",
        request_body=AdminOTPVerifySerializer,
        responses={200: openapi.Response("User authenticated")}
    )
    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=400)

        if getattr(user, "is_blocked", False):
            return Response({"error": "Account is blocked"}, status=403)

        totp = pyotp.TOTP(user.mfa_secret)

        if totp.verify(otp):
            tokens = get_tokens_for_user(user)
            return Response(
                {
                    "message": "Login successful",
                    "role": "USER",
                    "name": user.name,
                    "email": user.email,
                    "tokens": tokens,
                },
                status=status.HTTP_200_OK,
            )

        return Response({"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)


class DisableMFAView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Disable MFA for current user",
        responses={200: openapi.Response("MFA disabled")}
    )
    def post(self, request):
        user = request.user

        if not user.mfa_enabled:
            return Response(
                {"message": "MFA is already disabled."}, status=status.HTTP_200_OK
            )

        user.mfa_enabled = False
        user.mfa_secret = None
        user.save()

        return Response(
            {"message": "MFA has been disabled."}, status=status.HTTP_200_OK
        )


class OwnerBankDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Get owner bank details",
        responses={200: OwnerBankDetailsSerializer}
    )
    def get(self, request):

        try:
            details = request.user.bank_details
            serializer = OwnerBankDetailsSerializer(details)
            return Response(serializer.data)
        except OwnerBankDetails.DoesNotExist:
            return Response({}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        operation_summary="Create or update owner bank details",
        request_body=OwnerBankDetailsSerializer,
        responses={201: OwnerBankDetailsSerializer}
    )
    def post(self, request):

        details, created = OwnerBankDetails.objects.get_or_create(owner=request.user)

        if details.is_verified:
            return Response(
                {"error": "Verified details cannot be changed. Contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = OwnerBankDetailsSerializer(
            details, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
