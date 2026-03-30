from django.utils.decorators import method_decorator
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Conversation, Message
from notifications.utils import publish_notification
from rest_framework.generics import ListAPIView
from .models import Message, Conversation
from .serializers import MessageSerializer, ConversationSerializer
from django.db.models import Q
import json
import boto3
from assets.models import Asset
from rest_framework import serializers
from utils.assistant_service import send_message_to_assistant


class SendMessageRequestSerializer(serializers.Serializer):
    conversation_id = serializers.IntegerField()
    text = serializers.CharField()
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)


class AssistantMessageRequestSerializer(serializers.Serializer):
    text = serializers.CharField()


class StartConversationView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Start or reuse a conversation for an asset",
        manual_parameters=[
            openapi.Parameter("asset_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: openapi.Response("Conversation created or reused")}
    )
    def post(self, request, asset_id):

        asset = Asset.objects.get(id=asset_id)

        owner = asset.owner
        renter = request.user

        if owner == renter:
            return Response({"error": "You cannot chat with yourself"}, status=400)

        conversation, created = Conversation.objects.get_or_create(
            asset=asset, owner=owner, renter=renter
        )

        if created:
            publish_notification(
                event_type="CHAT_STARTED",
                recipient_id=owner.id,
                title="New Chat Started",
                message=f"{request.user.name} started a chat about {asset.title}",
                metadata={"conversation_id": conversation.id, "asset_id": asset.id},
            )

        return Response({"conversation_id": conversation.id})


class SendMessageView(APIView):

    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Send a chat message",
        request_body=SendMessageRequestSerializer,
        responses={200: openapi.Response("Message sent")}
    )
    def post(self, request):

        conversation_id = request.data.get("conversation_id")
        text = request.data.get("text")

        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        conversation = Conversation.objects.get(id=conversation_id)

        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            text=text,
            latitude=latitude,
            longitude=longitude,
        )

        return Response({"status": "sent", "message_id": message.id})


@method_decorator(
    name="get",
    decorator=swagger_auto_schema(
        operation_summary="List messages in a conversation",
        manual_parameters=[
            openapi.Parameter("conversation_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: MessageSerializer(many=True)}
    ),
)
class MessageListView(ListAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):

        conversation_id = self.kwargs["conversation_id"]
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return Message.objects.none()

        messages = Message.objects.filter(conversation_id=conversation_id).order_by(
            "created_at"
        )

        # mark messages as read
        messages.exclude(sender=user).update(is_read=True)

        return messages


@method_decorator(
    name="get",
    decorator=swagger_auto_schema(
        operation_summary="List current user's conversations",
        responses={200: ConversationSerializer(many=True)}
    ),
)
class UserConversationsView(ListAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):

        user = self.request.user

        return Conversation.objects.filter(Q(owner=user) | Q(renter=user))

    def get_serializer_context(self):
        return {"request": self.request}


from django.db.models import Q


class UnreadMessageCount(APIView):

    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Get unread chat message count",
        responses={200: openapi.Response("Unread count")}
    )
    def get(self, request):

        user = request.user

        count = (
            Message.objects.filter(is_read=False)
            .exclude(sender=user)
            .filter(Q(conversation__owner=user) | Q(conversation__renter=user))
            .count()
        )

        return Response({"count": count})


class AssistantConversationView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Get RentEase Assistant conversation metadata",
        responses={200: openapi.Response("Assistant conversation metadata")}
    )
    def get(self, request):
        return Response(
            {
                "conversation_id": "assistant",
                "other_user_name": "RentEase Assistant",
                "last_message": "Ask me about verification, booking flow, or payment issues.",
                "unread_count": 0,
            }
        )


class AssistantMessageView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Send a message to RentEase Assistant",
        request_body=AssistantMessageRequestSerializer,
        responses={200: openapi.Response("Assistant reply")}
    )
    def post(self, request):
        serializer = AssistantMessageRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = send_message_to_assistant(
            user_id=request.user.id,
            message=serializer.validated_data["text"],
        )

        return Response(
            {
                "conversation_id": "assistant",
                "reply": result.get("reply", ""),
                "intent": result.get("intent", "support_question"),
            }
        )
