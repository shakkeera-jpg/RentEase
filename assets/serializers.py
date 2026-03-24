import json
from rest_framework import serializers
from .models import Asset, AssetAvailability, Category, Review
from booking.models import Booking
from django.utils import timezone

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetAvailability
        fields = ["id", "available_from", "available_to"]

class AssetSerializer(serializers.ModelSerializer):
    
    availability = AvailabilitySerializer(many=True)
    owner_details = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = [
            "id",
            "title",
            "description",
            "city",
            "category",
            "price_per_day",
            "deposit",
            "asset_image",
            "availability",
            "owner_details",
            "is_available",
            "average_rating",
            "review_count",
        ]
        read_only_fields = ["city"]

    def get_is_available(self, obj):
        today = timezone.now().date()
        is_booked = Booking.objects.filter(
            asset=obj,
            start_date__lte=today,
            end_date__gte=today,
            status__in=["OWNER_PENDING", "APPROVED", "ACTIVE"]
        ).exists()
        
        return not is_booked    
    def get_owner_details(self, obj):
        return {
            "name": obj.owner.name if obj.owner.name else obj.owner.email,
            "joined": obj.owner.date_joined.strftime("%B %Y")
        }

    def get_average_rating(self, obj):
        from django.db.models import Avg
        avg = Review.objects.filter(booking__asset=obj, review_type="OWNER_REVIEW").aggregate(Avg("rating"))["rating__avg"]
        return round(avg, 1) if avg else 0

    def get_review_count(self, obj):
        return Review.objects.filter(booking__asset=obj, review_type="OWNER_REVIEW").count()

    def to_internal_value(self, data):
         
        if hasattr(data, 'dict'):
            data = data.dict()
        else:
            data = data.copy()

       
        availability = data.get("availability")
        if isinstance(availability, str):
            try:
                data["availability"] = json.loads(availability)
            except (json.JSONDecodeError, TypeError):
                raise serializers.ValidationError({
                    "availability": "Invalid JSON format for availability."
                })

        
        if not data.get("availability"):
            data["availability"] = []

        return super().to_internal_value(data)

    def create(self, validated_data):
        
        availability_data = validated_data.pop("availability", [])

       
        asset = Asset.objects.create(**validated_data)

        
        for item in availability_data:
            AssetAvailability.objects.create(asset=asset, **item)

        return asset

    def update(self, instance, validated_data):
        
        availability_data = validated_data.pop("availability", None)

        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        
        if availability_data is not None:
            instance.availability.all().delete()
            for item in availability_data:
                AssetAvailability.objects.create(asset=instance, **item)

        return instance


from .models import RentalRequest


class RentalRequestSerializer(serializers.ModelSerializer):
    asset_title = serializers.ReadOnlyField(source="asset.title")
    renter_username = serializers.ReadOnlyField(source="renter.username")

    class Meta:
        model = RentalRequest
        fields = [
            "id",
            "asset",
            "asset_title",
            "renter",
            "renter_username",
            "status",
            "created_at",
        ]
        read_only_fields = ["renter", "status"]

class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.ReadOnlyField(source="reviewer.name")

    class Meta:
        model = Review
        fields = [
            "id",
            "booking",
            "reviewer",
            "reviewer_name",
            "reviewee",
            "rating",
            "comment",
            "review_type",
            "created_at",
        ]
        read_only_fields = ["reviewer", "reviewee", "review_type"]
