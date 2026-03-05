from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_otp_email(user_email, otp_code):

    send_mail(
        subject="RentEase Email Verification OTP",
        message=f"Your OTP is {otp_code}. It is valid for 5 minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        fail_silently=False,
    )
