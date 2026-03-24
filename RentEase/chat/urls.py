from django.urls import path
from .views import (
    SendMessageView,
    MessageListView,
    UserConversationsView,
    StartConversationView,
    UnreadMessageCount,
)

urlpatterns = [
    path("start/<int:asset_id>/", StartConversationView.as_view()),
    path("send/", SendMessageView.as_view(), name="send-message"),
    path(
        "messages/<int:conversation_id>/",
        MessageListView.as_view(),
        name="message-list",
    ),
    path("conversations/", UserConversationsView.as_view(), name="user-conversations"),
    # Avoid clashing with notifications' "unread-count/" route.
    path("messages/unread-count/", UnreadMessageCount.as_view(), name="unread-message"),
]
