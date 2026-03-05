from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404

from .models import Asset, Category, RentalRequest, Review
from .serializers import AssetSerializer, CategorySerializer, RentalRequestSerializer, ReviewSerializer
from .permissions import IsProfileApproved
from booking.models import Booking
from booking.serializers import BookingSerializer

class CategoryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = Category.objects.all().order_by("name")
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)


class MyAssetAPIView(APIView):

    parser_classes = (MultiPartParser, FormParser)

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsProfileApproved()]
        return [IsAuthenticated()]

    def get(self, request):
        assets = Asset.objects.filter(owner=request.user)
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AssetSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(owner=request.user, city=request.user.profile.panchayat )
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

    def put(self, request, pk):
        asset = self.get_object(pk)

        if asset.owner != request.user:
            return Response(
                {"detail": "You are not allowed to edit this product."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = AssetSerializer(asset, data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        asset = self.get_object(pk)

        if asset.owner != request.user:
            return Response(
                {"detail": "You are not allowed to delete this product."},
                status=status.HTTP_403_FORBIDDEN
            )

        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssetListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = Asset.objects.filter(city=user.profile.panchayat).exclude(owner=user)

        # Advanced Search & Filtering
        search_query = request.query_params.get("search")
        category_id = request.query_params.get("category")
        min_price = request.query_params.get("min_price")
        max_price = request.query_params.get("max_price")

        if search_query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(title__icontains=search_query) | 
                Q(description__icontains=search_query)
            )
        
        if category_id:
            queryset = queryset.filter(category_id=category_id)
            
        if min_price:
            queryset = queryset.filter(price_per_day__gte=min_price)
            
        if max_price:
            queryset = queryset.filter(price_per_day__lte=max_price)

        serializer = AssetSerializer(queryset, many=True)
        return Response(serializer.data)


class ReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReviewSerializer(data=request.data)
        if serializer.is_valid():
            booking = serializer.validated_data["booking"]
            
            # Ensure the user was part of the booking and it's completed
            if booking.status != "COMPLETED":
                return Response({"detail": "You can only review completed bookings."}, status=400)
            
            if booking.renter != request.user and booking.asset.owner != request.user:
                 return Response({"detail": "Unauthorized."}, status=403)

            # Define reviewer/reviewee/type automatically
            if booking.renter == request.user:
                serializer.save(
                    reviewer=request.user, 
                    reviewee=booking.asset.owner,
                    review_type="OWNER_REVIEW"
                )
            else:
                serializer.save(
                    reviewer=request.user, 
                    reviewee=booking.renter,
                    review_type="RENTER_REVIEW"
                )
                
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def get(self, request):
        # Allow viewing reviews for an asset or a user
        asset_id = request.query_params.get("asset_id")
        user_id = request.query_params.get("user_id")
        
        if asset_id:
            reviews = Review.objects.filter(booking__asset_id=asset_id)
        elif user_id:
            reviews = Review.objects.filter(reviewee_id=user_id)
        else:
            return Response({"detail": "Provide asset_id or user_id."}, status=400)
            
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data)


class SendRentalRequestAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, asset_id):
        asset = get_object_or_404(Asset, id=asset_id)

        
        if asset.owner == request.user:
            return Response(
                {"detail": "You cannot rent your own asset."},
                status=400
            )

        
        if RentalRequest.objects.filter(
            asset=asset,
            renter=request.user
        ).exists():
            return Response(
                {"detail": "Request already sent."},
                status=400
            )

        rental_request = RentalRequest.objects.create(
            asset=asset,
            renter=request.user
        )

        serializer = RentalRequestSerializer(rental_request)
        return Response(serializer.data, status=201)


class OwnerRentalRequestsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        
        requests = Booking.objects.filter(
            asset__owner=request.user,
            status__in=["OWNER_PENDING", "APPROVED", "DELIVERED"] 
        ).order_by("-created_at")

        
        serializer = BookingSerializer(requests, many=True)
        return Response(serializer.data)


class ManageRentalRequestAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        rental_request = get_object_or_404(
            RentalRequest,
            id=request_id
        )

       
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

        return Response({
            "message": f"Request {rental_request.status.lower()} successfully."
        })
