from django.urls import path

from .views import (
    SaveFCMTokenView,
    MyNotificationsView,
    MarkNotificationRead,
    UnreadNotificationCount,
    MarkAllNotificationsRead,
)

urlpatterns = [
    path("save-fcm-token/", SaveFCMTokenView.as_view()),
    path("my/", MyNotificationsView.as_view()),
    path("read/<int:notification_id>/", MarkNotificationRead.as_view()),
    path("unread-count/", UnreadNotificationCount.as_view()),
    path("mark-all-read/", MarkAllNotificationsRead.as_view()),
]
