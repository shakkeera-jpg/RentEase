from django.urls import path
from .views import (
    SendMessageView,
    MessageListView,
    UserConversationsView,
    StartConversationView,
    UnreadMessageCount,
    AssistantConversationView,
    AssistantMessageView,
)

urlpatterns = [
    path("start/<int:asset_id>/", StartConversationView.as_view()),
    path("assistant/", AssistantConversationView.as_view(), name="assistant-conversation"),
    path("assistant/send/", AssistantMessageView.as_view(), name="assistant-send"),
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
