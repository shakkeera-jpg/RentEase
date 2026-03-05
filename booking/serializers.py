# serializers.py

from rest_framework import serializers
from .models import Booking
from datetime import date
from decimal import Decimal
from django.conf import settings


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
        commission_rate = Decimal(str(settings.PLATFORM_COMMISSION))
        commission = total_rent * commission_rate

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
    renter_name = serializers.ReadOnlyField(source="renter.name") 
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "asset_title", "renter_name", "start_date", 
            "end_date", "status", "total_rent", "deposit", 
            "total_amount", "created_at"
        ]

    def get_total_amount(self, obj):
        return obj.get_total_paid()    