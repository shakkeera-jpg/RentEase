from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification
from django.db.models import Count

from .models import DeviceToken


class DeviceTokenSerializer(serializers.Serializer):
    device_token = serializers.CharField()


class NotificationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    message = serializers.CharField()
    is_read = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class SaveFCMTokenView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Save or update the current user's FCM token",
        request_body=DeviceTokenSerializer,
        responses={200: openapi.Response("Token saved")}
    )
    def post(self, request):
        token = request.data.get("device_token")

        if not token:
            return Response({"error": "Token missing"}, status=400)

        DeviceToken.objects.update_or_create(
            user=request.user, defaults={"token": token}
        )

        return Response({"message": "Token saved"})


class MyNotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List current user's notifications",
        responses={200: NotificationSerializer(many=True)}
    )
    def get(self, request):
        notifications = Notification.objects.filter(user=request.user).order_by(
            "-created_at"
        )

        data = [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifications
        ]

        return Response(data)


class MarkNotificationRead(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Mark a notification as read",
        manual_parameters=[
            openapi.Parameter("notification_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True)
        ],
        responses={200: openapi.Response("Notification marked as read")}
    )
    def post(self, request, notification_id):

        notif = Notification.objects.get(id=notification_id, user=request.user)

        notif.is_read = True
        notif.save()

        return Response({"message": "Notification marked as read"})


class UnreadNotificationCount(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Get unread notification count",
        responses={200: openapi.Response("Unread count")}
    )
    def get(self, request):

        count = Notification.objects.filter(user=request.user, is_read=False).count()

        return Response({"count": count})


class MarkAllNotificationsRead(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Mark all notifications as read",
        responses={200: openapi.Response("All notifications marked read")}
    )
    def post(self, request):

        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )

        return Response({"message": "All notifications marked read"})
