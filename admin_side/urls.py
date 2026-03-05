
from django.urls import path
from .views import PendingVerificationListView, ApproveRejectVerificationView

urlpatterns = [
    path('pending/', PendingVerificationListView.as_view(), name='admin-pending-list'),
    path('action/<int:profile_id>/', ApproveRejectVerificationView.as_view(), name='admin-verify-action'),
]