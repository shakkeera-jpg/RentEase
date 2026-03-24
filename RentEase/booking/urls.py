from django.urls import path

from .views import (
    CreateBookingView,
    FinalizeReturnView,
    MyRentalsView,
    OwnerActionView,
    RenterCancelView,
    UpdateBookingStatusView,
)

urlpatterns = [
    path("create/", CreateBookingView.as_view(), name="create-booking"),
    path(
        "owner-action/<int:booking_id>/", OwnerActionView.as_view(), name="owner-action"
    ),
    path("cancel/<int:booking_id>/", RenterCancelView.as_view(), name="renter-cancel"),
    path(
        "finalize/<int:booking_id>/",
        FinalizeReturnView.as_view(),
        name="finalize-booking",
    ),
    path("my-rentals", MyRentalsView.as_view(), name="my-rentals"),
    path(
        "update-status/<int:booking_id>/",
        UpdateBookingStatusView.as_view(),
        name="update-status",
    ),
]
