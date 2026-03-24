from django.urls import path

from .views import (
    AdminSettlementActionView,
    AdminSettlementListView,
    AdminUserListView,
    AdminUserStatusView,
    ApproveRejectVerificationView,
    PendingVerificationListView,
)

urlpatterns = [
    path("pending/", PendingVerificationListView.as_view(), name="admin-pending-list"),
    path(
        "action/<int:profile_id>/",
        ApproveRejectVerificationView.as_view(),
        name="admin-verify-action",
    ),
    path(
        "settlements/", AdminSettlementListView.as_view(), name="admin-settlement-list"
    ),
    path(
        "settlements/<int:booking_id>/settle/",
        AdminSettlementActionView.as_view(),
        name="admin-settlement-action",
    ),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path(
        "admin/users/<int:user_id>/status/",
        AdminUserStatusView.as_view(),
        name="admin-user-status",
    ),
]
