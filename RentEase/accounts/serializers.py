from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from accounts.models import DeviceFingerprint, User

from .models import OwnerBankDetails

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    fingerprint = serializers.CharField()

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match")

        if User.objects.filter(email=data["email"]).exists():
            raise serializers.ValidationError("Email already registered")

        if DeviceFingerprint.objects.filter(
            fingerprint=data["fingerprint"], is_blocked=True
        ).exists():
            raise serializers.ValidationError("This device is blocked")

        return data

    def create(self, validated_data):
        validated_data.pop("confirm_password")

        user = User.objects.create(
            name=validated_data["name"],
            email=validated_data["email"],
            password=make_password(validated_data["password"]),
            is_active=False,
            role="USER",
        )

        DeviceFingerprint.objects.get_or_create(
            user=user,
            fingerprint=validated_data["fingerprint"],
        )

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    fingerprint = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        email = data.get("email")
        password = data.get("password")

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password")

        if getattr(user, "is_blocked", False):
            raise serializers.ValidationError("Account is blocked")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password")

        if not user.is_active:
            raise serializers.ValidationError("Email not verified")

        data["user"] = user
        return data


class AdminOTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email does not exist")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField()
    new_password = serializers.CharField(min_length=8)


class OwnerBankDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerBankDetails
        fields = [
            "account_holder_name",
            "bank_name",
            "account_number",
            "ifsc_code",
            "upi_id",
            "is_verified",
        ]

        read_only_fields = ["is_verified"]
