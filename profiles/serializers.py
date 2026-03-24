from rest_framework import serializers
from .models import (
    UserProfile,
    District,
    Taluk,
    Panchayat
)


class ProfileSerializer(serializers.ModelSerializer):

    name = serializers.ReadOnlyField(source="user.name")
    mfa_enabled=serializers.ReadOnlyField(source="user.mfa_enabled")

    
    panchayat = serializers.PrimaryKeyRelatedField(
        queryset=Panchayat.objects.all(),
        required=False
    )

    
    district = serializers.CharField(
        source="district.name",
        read_only=True
    )

    taluk = serializers.CharField(
        source="taluk.name",
        read_only=True
    )

    panchayat_name = serializers.CharField(
        source="panchayat.name",
        read_only=True
    )

    class Meta:
        model = UserProfile
        fields = [
            "phone",
            "address",
            "panchayat",
            "panchayat_name",
            "taluk",
            "district",
            "is_completed",
            "verification_status",
            "id_document",
            "name",
            "mfa_enabled",

        ]
        read_only_fields = [
            "is_completed",
            "verification_status",
            "district",
            "taluk",
            "panchayat_name",
            "name",
        ]

    def validate_phone(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("Phone must be numeric")
        return value

    def update(self, instance, validated_data):
        instance.phone = validated_data.get("phone", instance.phone)
        instance.address = validated_data.get("address", instance.address)
        instance.panchayat = validated_data.get("panchayat", instance.panchayat)

        instance.is_completed = True
        instance.save()
        return instance




class VerificationSerializer(serializers.ModelSerializer):

    class Meta:
        model = UserProfile
        fields = [
            "id_document",
            "verification_status",
            "rejection_reason",
        ]
        read_only_fields = [
            "verification_status",
            "rejection_reason",
        ]

    def validate(self, attrs):
        profile = self.instance

        if profile.verification_status in ["PENDING", "APPROVED"]:
            raise serializers.ValidationError(
                "Verification already submitted or approved."
            )

        return attrs

    def update(self, instance, validated_data):
        instance.id_document = validated_data.get(
            "id_document",
            instance.id_document
        )
        instance.verification_status = "PENDING"
        instance.rejection_reason = ""
        instance.save()
        return instance
