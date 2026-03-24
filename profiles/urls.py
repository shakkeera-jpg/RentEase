from django.urls import path
from .views import ProfileView,VerificationView,DistrictListAPIView,TalukListAPIView,PanchayatListAPIView

urlpatterns = [
    path("profile/", ProfileView.as_view()),
    path("profile/verification/", VerificationView.as_view()),

    path("districts/", DistrictListAPIView.as_view()),
    path("taluks/<int:district_id>/", TalukListAPIView.as_view()),
    path("panchayats/<int:taluk_id>/", PanchayatListAPIView.as_view()),
]