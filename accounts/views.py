from django.shortcuts import render
import random
import hashlib
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from accounts.models import User, OTP
from django.core.mail import send_mail
from django.conf import settings
from accounts.serializers import (
    LoginSerializer,
    AdminOTPVerifySerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    RegisterSerializer,
)
import time
from accounts.utils import get_tokens_for_user
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from accounts.models import DeviceFingerprint
from drf_yasg.utils import swagger_auto_schema
from google.oauth2 import id_token
from rest_framework.decorators import api_view, permission_classes
from google.auth.transport import requests
import qrcode
import base64
import io
import pyotp
from .tasks import send_otp_email

User = get_user_model()


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
            {"name":user.name,"message": "OTP sent to your email",}, status=status.HTTP_201_CREATED
        )


class VerifyEmailOTPView(APIView):
    permission_classes = []

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
        request_body=LoginSerializer,
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
                {"message": "Login successful", "role": "USER", "tokens": tokens},
                status=status.HTTP_200_OK,
            )

        if user.role == "ADMIN":

            if user.is_otp_verified:
                tokens = get_tokens_for_user(user)
                return Response(
                    {
                        "message": "Admin login successful",
                        "role": "ADMIN",
                        "tokens": tokens,
                        "otp_required": False,
                    },
                    status=status.HTTP_200_OK,
                )

            otp = generate_otp()
            OTP.objects.create(user=user, otp_hash=hash_otp(otp), purpose="ADMIN_LOGIN")

            send_mail(
                subject="RentEase Admin Login OTP",
                message=f"Your admin login OTP is {otp}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

            return Response(
                {
                    "message": "OTP sent to admin email",
                    "role": "ADMIN",
                    "otp_required": True,
                },
                status=status.HTTP_200_OK,
            )

        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)


class AdminOTPVerifyView(APIView):
    permission_classes = [AllowAny]

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
            {"message": "Admin login successful", "role": "ADMIN", "tokens": tokens},
            status=status.HTTP_200_OK,
        )


class AcceptAgreementView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        user = User.objects.get(email=email)

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
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"message": "OTP sent to your email"}, status=status.HTTP_200_OK
        )


class ResetPasswordView(APIView):
    permission_classes = []

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

    @swagger_auto_schema(responses={200: "Logout successful"})
    def post(self, request):
        return Response(
            {"message": "Logged out successfully"}, status=status.HTTP_200_OK
        )
class AdminOTPVerifyView(APIView):
    permission_classes = [AllowAny]

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
            {"message": "Admin login successful", "role": "ADMIN", "tokens": tokens},
            status=status.HTTP_200_OK,
        )


class AcceptAgreementView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        user = User.objects.get(email=email)

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
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {"message": "OTP sent to your email"}, status=status.HTTP_200_OK
        )


class ResetPasswordView(APIView):
    permission_classes = []

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

    @swagger_auto_schema(responses={200: "Logout successful"})
    def post(self, request):
        return Response(
            {"message": "Logged out successfully"}, status=status.HTTP_200_OK
        )


@api_view(["POST"])
def google_login(request):
    token = request.data.get("token")
    fingerprint = request.data.get("fingerprint")

    if not token:
        return Response({"error": "Token missing"}, status=400)

    # Check device fingerprint block
    if fingerprint:
        blocked = DeviceFingerprint.objects.filter(
            fingerprint=fingerprint, is_blocked=True
        ).exists()
        if blocked:
            return Response(
                {"error": "Device blocked"}, status=status.HTTP_403_FORBIDDEN
            )

    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), settings.GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")

        if not email:
            return Response({"error": "Email missing in token"}, status=400)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "name": name or email.split("@")[0],
                "is_active": True,
            },
        )

        if user.role == "USER" and not user.has_agreed_terms:
            return Response(
                {"agreement_required": True, "email": user.email},
                status=status.HTTP_200_OK,
            )

        if user.role == "USER" and user.mfa_enabled:
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

        if user.role == "ADMIN":
            if not user.is_otp_verified:
                otp = generate_otp()
                OTP.objects.create(user=user, otp_hash=hash_otp(otp), purpose="ADMIN_LOGIN")

                send_mail(
                    subject="RentEase Admin Login OTP",
                    message=f"Your admin login OTP is {otp}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
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

        tokens = get_tokens_for_user(user)

        return Response(
            {
                "message": "Login successful",
                "role": user.role,
                "name": user.name,
                "email": user.email,
                "tokens": tokens,
            }
        )

    except ValueError:
        return Response({"error": "Invalid token"}, status=400)


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

    def post(self, request):
        email = request.data.get("email")
        otp = request.data.get("otp")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=400)

        totp = pyotp.TOTP(user.mfa_secret)

        if totp.verify(otp):
            tokens = get_tokens_for_user(user)
            return Response(
                {
                    "message": "Login successful",
                    "role": "USER",
                    "tokens": tokens,
                },
                status=status.HTTP_200_OK,
            )

        return Response({"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
    

class DisableMFAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        
        if not user.mfa_enabled:
            return Response(
                {"message": "MFA is already disabled."}, 
                status=status.HTTP_200_OK
            )

        user.mfa_enabled = False
        user.mfa_secret = None  
        user.save()

        return Response(
            {"message": "MFA has been disabled."}, 
            status=status.HTTP_200_OK
        )
    
