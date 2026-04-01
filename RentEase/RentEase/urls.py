"""
URL configuration for RentEase project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

_schema_url = os.environ.get("SWAGGER_DEFAULT_URL")

schema_view = get_schema_view(
    openapi.Info(
        title="RentEase API",
        default_version="v1",
        description="Swagger documentation for the RentEase backend APIs.",
        contact=openapi.Contact(email="support@rentease.local"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
    url=_schema_url,
)

urlpatterns = [
    re_path(
        r"^swagger(?P<format>\.json|\.yaml)$",
        schema_view.without_ui(cache_timeout=0),
        name="schema-json",
    ),
    re_path(
        r"^swagger/$",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    re_path(
        r"^redoc/$", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"
    ),
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("profiles.urls")),
    path("api/", include("admin_side.urls")),
    path("api/", include("assets.urls")),
    path("api/", include("booking.urls")),
    path("api/payment/", include("payments.urls")),
    path("api/rentals/", include("Rentals.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("chat.urls")),
]
if settings.DEBUG or getattr(settings, "SERVE_MEDIA", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
