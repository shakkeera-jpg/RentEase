from django.urls import path

from .views import PublicAssetAPIView

urlpatterns = [
    path("assets/", PublicAssetAPIView.as_view()),
    path("assets/<int:pk>/", PublicAssetAPIView.as_view()),
]
