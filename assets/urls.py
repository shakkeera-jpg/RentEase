from django.urls import path
from .views import (
    MyAssetAPIView, MyAssetDetailAPIView, CategoryAPIView, AssetListAPIView, 
    SendRentalRequestAPIView, OwnerRentalRequestsAPIView, ManageRentalRequestAPIView, 
    ReviewAPIView
)
    

urlpatterns = [
    path("my-assets/", MyAssetAPIView.as_view(), name="my-assets"),
    path("my-assets/<int:pk>/", MyAssetDetailAPIView.as_view(), name="my-asset-detail"),
    path("categories/", CategoryAPIView.as_view(), name="categories"),
    path("assets/", AssetListAPIView.as_view()),
    path("rent/<int:asset_id>/", SendRentalRequestAPIView.as_view()),
    path("owner/requests/", OwnerRentalRequestsAPIView.as_view()),
    path("owner/requests/<int:request_id>/", ManageRentalRequestAPIView.as_view()),
    path("reviews/", ReviewAPIView.as_view(), name="reviews"),
]
