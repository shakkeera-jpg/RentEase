from .settings import *  # noqa: F403

# Use the plain app config during tests to avoid side effects from signals.
INSTALLED_APPS = [
    "profiles" if app == "profiles.apps.ProfilesConfig" else app
    for app in INSTALLED_APPS  # noqa: F405
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_dummy")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "test_secret")
AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost")
