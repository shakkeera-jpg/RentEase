import os
from celery import Celery


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "RentEase.settings")

app = Celery("RentEase")


app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()
