from datetime import date
from decimal import Decimal

from django.conf import settings
from rest_framework import serializers

from .models import Booking


class CreateBookingSerializer(serializers.ModelSerializer):

    class Meta:
        model = Booking
        fields = ["asset", "start_date", "end_date"]

    def validate(self, data):
        if data["start_date"] < date.today():
            raise serializers.ValidationError("Invalid start date")
        if data["end_date"] <= data["start_date"]:
            raise serializers.ValidationError("Invalid end date")
        return data

    def create(self, validated_data):
        asset = validated_data["asset"]
        renter = self.context["request"].user
        days = (validated_data["end_date"] - validated_data["start_date"]).days

        total_rent = asset.price_per_day * days
        deposit = asset.deposit
        commission = total_rent * Decimal(str(settings.PLATFORM_COMMISSION))

        return Booking.objects.create(
            asset=asset,
            renter=renter,
            start_date=validated_data["start_date"],
            end_date=validated_data["end_date"],
            total_rent=total_rent,
            deposit=deposit,
            commission=commission,
        )


class BookingSerializer(serializers.ModelSerializer):

    asset_title = serializers.ReadOnlyField(source="asset.title")
    asset_id = serializers.ReadOnlyField(source="asset.id")
    asset_image = serializers.SerializerMethodField()

    renter_name = serializers.ReadOnlyField(source="renter.name")
    renter_id = serializers.ReadOnlyField(source="renter.id")

    owner_name = serializers.ReadOnlyField(source="asset.owner.name")
    owner_id = serializers.ReadOnlyField(source="asset.owner.id")

    total_paid = serializers.SerializerMethodField()
    refundable_deposit = serializers.SerializerMethodField()
    owner_payout = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "asset_id",
            "asset_title",
            "asset_image",
            "renter_id",
            "renter_name",
            "owner_id",
            "owner_name",
            "start_date",
            "end_date",
            "status",
            "owner_deadline",
            "total_rent",
            "deposit",
            "commission",
            "penalty_deducted",
            "total_paid",
            "refundable_deposit",
            "owner_payout",
            "paid_at",
            "created_at",
        ]

    def get_asset_image(self, obj):
        image = getattr(obj.asset, "asset_image", None)
        if not image:
            return None
        try:
            return image.url
        except Exception:
            return None

    def get_total_paid(self, obj):
        return obj.get_total_paid()

    def get_refundable_deposit(self, obj):
        return obj.get_refundable_deposit()

    def get_owner_payout(self, obj):
        return obj.get_owner_payout()


class OwnerBookingSerializer(BookingSerializer):

    renter_details = serializers.SerializerMethodField()

    class Meta(BookingSerializer.Meta):
        fields = BookingSerializer.Meta.fields + ["renter_details"]

    def get_renter_details(self, obj):
        renter = obj.renter
        profile = getattr(renter, "profile", None)

        if not profile:
            return {
                "id": renter.id,
                "name": renter.name,
                "email": renter.email,
                "trust_score": getattr(renter, "trust_score", None),
            }

        panchayat = getattr(profile, "panchayat", None)
        taluk = getattr(panchayat, "taluk", None) if panchayat else None
        district = getattr(taluk, "district", None) if taluk else None

        return {
            "id": renter.id,
            "name": renter.name,
            "email": renter.email,
            "trust_score": getattr(renter, "trust_score", None),
            "phone": profile.phone,
            "address": profile.address,
            "verification_status": profile.verification_status,
            "is_completed": profile.is_completed,
            "panchayat": getattr(panchayat, "name", None),
            "taluk": getattr(taluk, "name", None),
            "district": getattr(district, "name", None),
        }
