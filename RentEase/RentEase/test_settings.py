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
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "rentease-test-cache",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
