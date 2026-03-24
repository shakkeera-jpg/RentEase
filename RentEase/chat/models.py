from django.db import models
from django.contrib.auth import get_user_model
from assets.models import Asset

User = get_user_model()


class Conversation(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    owner = models.ForeignKey(
        User, related_name="owner_conversations", on_delete=models.CASCADE
    )
    renter = models.ForeignKey(
        User, related_name="renter_conversations", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["asset", "owner", "renter"]


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
