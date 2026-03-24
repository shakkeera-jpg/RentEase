from django.urls import path

from .views import (
    AssetListAPIView,
    AssetReviewListAPIView,
    CategoryAPIView,
    CreateAssetReviewAPIView,
    ManageRentalRequestAPIView,
    MyAssetAPIView,
    MyAssetDetailAPIView,
    OwnerRentalRequestsAPIView,
    SendRentalRequestAPIView,
)

urlpatterns = [
    path("my-assets/", MyAssetAPIView.as_view(), name="my-assets"),
    path("my-assets/<int:pk>/", MyAssetDetailAPIView.as_view(), name="my-asset-detail"),
    path("categories/", CategoryAPIView.as_view(), name="categories"),
    path("assets/", AssetListAPIView.as_view()),
    path(
        "assets/<int:asset_id>/reviews/",
        AssetReviewListAPIView.as_view(),
        name="asset-reviews",
    ),
    path(
        "bookings/<int:booking_id>/review/",
        CreateAssetReviewAPIView.as_view(),
        name="booking-asset-review",
    ),
    path("rent/<int:asset_id>/", SendRentalRequestAPIView.as_view()),
    path("owner/requests/", OwnerRentalRequestsAPIView.as_view()),
    path("owner/requests/<int:request_id>/", ManageRentalRequestAPIView.as_view()),
]
