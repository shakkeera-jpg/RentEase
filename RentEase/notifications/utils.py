import json

import boto3
from django.conf import settings

from .models import DeviceToken, Notification


def _get_sqs_client():
    if not getattr(settings, "AWS_REGION", None):
        return None
    return boto3.client(
        "sqs",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def publish_notification(event_type, recipient_id, title, message, metadata=None):
    print("DEBUG: publish_notification called")

    token_record = (
        DeviceToken.objects.filter(user_id=recipient_id).order_by("-created_at").first()
    )
    device_token = token_record.token if token_record else None

    if not device_token:
        print(f"Warning: No device token found for user {recipient_id}")

    event = {
        "event_type": event_type,
        "recipient_id": str(recipient_id),
        "device_token": device_token,
        "title": title,
        "message": message,
        "metadata": metadata or {},
    }

    Notification.objects.create(
        user_id=recipient_id,
        title=title,
        message=message,
        event_type=event_type,
        metadata=metadata or {},
    )

    queue_url = getattr(settings, "NOTIFICATION_QUEUE_URL", "")
    if not queue_url:
        print("Skipping SQS publish; NOTIFICATION_QUEUE_URL not set.")
        return

    sqs = _get_sqs_client()
    if not sqs:
        print("Skipping SQS publish; AWS_REGION not set.")
        return

    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(event))
