import hashlib

from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch, Q
from django.core.cache import cache
from django.utils import timezone
from django.db.utils import OperationalError, ProgrammingError
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from booking.models import Booking
from booking.serializers import OwnerBookingSerializer

from .models import Asset, AssetReview, Category, RentalRequest
from .permissions import IsProfileApproved
from .serializers import (
    AssetReviewSerializer,
    AssetSerializer,
    CategorySerializer,
    RentalRequestSerializer,
)


class RentalRequestActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])


class AssetReviewCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    feedback = serializers.CharField(required=False, allow_blank=True)


class AssetWriteSwaggerSerializer(serializers.Serializer):
    title = serializers.CharField()
    description = serializers.CharField()
    category = serializers.IntegerField()
    price_per_day = serializers.DecimalField(max_digits=10, decimal_places=2)
    deposit = serializers.DecimalField(max_digits=10, decimal_places=2)
    asset_image = serializers.ImageField(required=False)
    availability = serializers.CharField(
        help_text='JSON array string, for example: [{"available_from":"2026-03-23","available_to":"2026-03-30"}]'
    )


def _cache_key(prefix: str, *parts: object) -> str:
    raw = "|".join("" if p is None else str(p) for p in parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{prefix}:{digest}"


def _db_not_ready():
    return Response(
        {
            "detail": "Database schema is not up to date. Run `python manage.py migrate`."
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _active_booking_prefetch():
    today = timezone.now().date()
    return Prefetch(
        "booking_set",
        queryset=Booking.objects.filter(
            start_date__lte=today,
            end_date__gte=today,
            status__in=["OWNER_PENDING", "APPROVED", "ACTIVE"],
        ),
        to_attr="active_bookings",
    )


class CategoryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List asset categories",
        responses={200: CategorySerializer(many=True)}
    )
    def get(self, request):
        cache_key = _cache_key("categories:list")
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        categories = Category.objects.all().order_by("name")
        serializer = CategorySerializer(categories, many=True)
        data = serializer.data
        cache.set(cache_key, data, timeout=60 * 60 * 12)  # 12h
        return Response(data)


class MyAssetAPIView(APIView):

    parser_classes = (MultiPartParser, FormParser)

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsProfileApproved()]
        return [IsAuthenticated()]

    @swagger_auto_schema(
        operation_summary="List current user's assets",
        responses={200: AssetSerializer(many=True)}
    )
    def get(self, request):
        assets = (
            Asset.objects.filter(owner=request.user)
            .select_related("owner", "category", "city")
            .prefetch_related("availability", _active_booking_prefetch())
        )
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_summary="Create a new asset",
        request_body=AssetWriteSwaggerSerializer,
        responses={201: AssetSerializer}
    )
    def post(self, request):
        serializer = AssetSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(owner=request.user, city=request.user.profile.panchayat)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyAssetDetailAPIView(APIView):

    parser_classes = (MultiPartParser, FormParser)

    def get_permissions(self):
        if self.request.method in ["PUT", "DELETE"]:
            return [IsAuthenticated(), IsProfileApproved()]
        return [IsAuthenticated()]

    def get_object(self, pk):
        return get_object_or_404(Asset, pk=pk)

    @swagger_auto_schema(
        operation_summary="Update an owned asset",
        manual_parameters=[
            openapi.Parameter("pk", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=AssetWriteSwaggerSerializer,
        responses={200: AssetSerializer}
    )
    def put(self, request, pk):
        asset = self.get_object(pk)

        if asset.owner != request.user:
            return Response(
                {"detail": "You are not allowed to edit this product."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssetSerializer(asset, data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        operation_summary="Delete an owned asset",
        manual_parameters=[
            openapi.Parameter("pk", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={204: "Deleted"}
    )
    def delete(self, request, pk):
        asset = self.get_object(pk)

        if asset.owner != request.user:
            return Response(
                {"detail": "You are not allowed to delete this product."},
                status=status.HTTP_403_FORBIDDEN,
            )

        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssetListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List rentable assets in the current user's area",
        manual_parameters=[
            openapi.Parameter("search", openapi.IN_QUERY, type=openapi.TYPE_STRING)
        ],
        responses={200: AssetSerializer(many=True)}
    )
    def get(self, request):
        user = request.user

        search = (request.query_params.get("search") or "").strip()
        panchayat_id = getattr(user.profile, "panchayat_id", None)
        cache_key = _cache_key("assets:list", user.id, panchayat_id, search.lower())

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        assets = (
            Asset.objects.filter(city=user.profile.panchayat)
            .exclude(owner=user)
            .select_related("owner", "category", "city")
            .prefetch_related("availability", _active_booking_prefetch())
        )
        if search:
            assets = assets.filter(Q(title__icontains=search))

        serializer = AssetSerializer(assets, many=True)
        data = serializer.data
        cache.set(cache_key, data, timeout=15)  # short TTL: availability can change
        return Response(data)


class SendRentalRequestAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProfileApproved]

    @swagger_auto_schema(
        operation_summary="Send a rental request for an asset",
        manual_parameters=[
            openapi.Parameter("asset_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={201: RentalRequestSerializer}
    )
    def post(self, request, asset_id):
        asset = get_object_or_404(Asset, id=asset_id)

        if asset.owner == request.user:
            return Response({"detail": "You cannot rent your own asset."}, status=400)

        if RentalRequest.objects.filter(asset=asset, renter=request.user).exists():
            return Response({"detail": "Request already sent."}, status=400)

        rental_request = RentalRequest.objects.create(asset=asset, renter=request.user)

        serializer = RentalRequestSerializer(rental_request)
        return Response(serializer.data, status=201)


class OwnerRentalRequestsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List booking requests for assets owned by the current user",
        responses={200: OwnerBookingSerializer(many=True)}
    )
    def get(self, request):

        bookings = (
            Booking.objects.filter(asset__owner=request.user)
            .select_related(
                "asset",
                "renter",
                "renter__profile",
                "renter__profile__panchayat",
                "renter__profile__panchayat__taluk",
                "renter__profile__panchayat__taluk__district",
            )
            .order_by("-created_at")
        )

        serializer = OwnerBookingSerializer(bookings, many=True)
        return Response(serializer.data)


class ManageRentalRequestAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Approve or reject a rental request",
        manual_parameters=[
            openapi.Parameter("request_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=RentalRequestActionSerializer,
        responses={200: openapi.Response("Rental request updated")}
    )
    def post(self, request, request_id):
        rental_request = get_object_or_404(RentalRequest, id=request_id)

        if rental_request.asset.owner != request.user:
            return Response({"detail": "Not allowed."}, status=403)

        action = request.data.get("action")

        if action == "approve":
            rental_request.status = "APPROVED"

        elif action == "reject":
            rental_request.status = "REJECTED"

        else:
            return Response({"detail": "Invalid action."}, status=400)

        rental_request.save()

        return Response(
            {"message": f"Request {rental_request.status.lower()} successfully."}
        )


class AssetReviewListAPIView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(
        operation_summary="List reviews for an asset",
        manual_parameters=[
            openapi.Parameter("asset_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: AssetReviewSerializer(many=True)}
    )
    def get(self, request, asset_id: int):
        try:
            reviews = (
                AssetReview.objects.filter(asset_id=asset_id)
                .select_related("reviewer")
                .order_by("-created_at")
            )
            serializer = AssetReviewSerializer(reviews, many=True)
            return Response(serializer.data)
        except (ProgrammingError, OperationalError):
            return _db_not_ready()


class CreateAssetReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Create a review for a completed booking",
        manual_parameters=[
            openapi.Parameter("booking_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        request_body=AssetReviewCreateSerializer,
        responses={201: AssetReviewSerializer}
    )
    def post(self, request, booking_id: int):
        booking = get_object_or_404(
            Booking.objects.select_related("asset", "renter"), id=booking_id
        )

        if booking.renter != request.user:
            return Response(
                {"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN
            )

        if booking.status not in {
            "RETURN_REQUESTED",
            "ADMIN_SETTLEMENT_PENDING",
            "COMPLETED",
        }:
            return Response(
                {"detail": "You can review only after returning the product."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if hasattr(booking, "asset_review"):
                return Response(
                    {"detail": "Review already submitted."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except (ProgrammingError, OperationalError):
            return _db_not_ready()

        rating = request.data.get("rating")
        feedback = request.data.get("feedback", "")

        try:
            rating_int = int(rating)
        except Exception:
            return Response(
                {"rating": ["A valid integer is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssetReviewSerializer(
            data={
                "asset": booking.asset_id,
                "booking": booking.id,
                "rating": rating_int,
                "feedback": feedback,
            }
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            review = AssetReview.objects.create(
                asset=booking.asset,
                booking=booking,
                reviewer=request.user,
                rating=rating_int,
                feedback=feedback or "",
            )
            return Response(
                AssetReviewSerializer(review).data, status=status.HTTP_201_CREATED
            )
        except (ProgrammingError, OperationalError):
            return _db_not_ready()
