from rest_framework import serializers
from .models import Message, Conversation


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "latitude",
            "longitude",
            "text",
            "created_at",
        ]


class ConversationSerializer(serializers.ModelSerializer):

    other_user_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "other_user_name", "last_message", "unread_count", "created_at"]

    def get_other_user_name(self, obj):

        user = self.context["request"].user

        if obj.owner == user:
            return obj.renter.name
        return obj.owner.name

    def get_last_message(self, obj):

        last = obj.messages.order_by("-created_at").first()

        if last:
            return last.text

        return ""

    def get_unread_count(self, obj):

        user = self.context["request"].user

        return obj.messages.exclude(sender=user).filter(is_read=False).count()
