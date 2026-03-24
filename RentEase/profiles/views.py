from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.core.cache import cache
from rest_framework import status
from rest_framework import serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import District, Panchayat, Taluk
from .permissions import IsBasicProfileCompleted
from .serializers import ProfileSerializer, VerificationSerializer


class LocationOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @swagger_auto_schema(
        operation_summary="Get current user profile",
        responses={200: ProfileSerializer}
    )
    def get(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_summary="Create or update basic profile",
        request_body=ProfileSerializer,
        responses={200: ProfileSerializer}
    )
    def put(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(profile, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Profile completed successfully", "data": serializer.data}
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerificationView(APIView):
    permission_classes = [IsAuthenticated, IsBasicProfileCompleted]

    parser_classes = [MultiPartParser, FormParser]

    @swagger_auto_schema(
        operation_summary="Get verification document status",
        responses={200: VerificationSerializer}
    )
    def get(self, request):
        profile = request.user.profile
        serializer = VerificationSerializer(profile)
        return Response(serializer.data)

    @swagger_auto_schema(
        operation_summary="Upload or re-upload verification document",
        request_body=VerificationSerializer,
        responses={200: openapi.Response("ID uploaded")}
    )
    def put(self, request):
        profile = request.user.profile

        serializer = VerificationSerializer(profile, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Verification submitted successfully"})

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DistrictListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List districts",
        responses={200: LocationOptionSerializer(many=True)}
    )
    def get(self, request):
        cache_key = "districts:list:v1"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        districts = District.objects.all().order_by("name")
        data = [{"id": d.id, "name": d.name} for d in districts]
        cache.set(cache_key, data, timeout=60 * 60 * 24)  # 24h
        return Response(data)


class TalukListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List taluks for a district",
        manual_parameters=[
            openapi.Parameter(
                "district_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True
            )
        ],
        responses={200: LocationOptionSerializer(many=True)}
    )
    def get(self, request, district_id):
        cache_key = f"taluks:list:{district_id}:v1"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        taluks = Taluk.objects.filter(district_id=district_id)
        data = [{"id": t.id, "name": t.name} for t in taluks]
        cache.set(cache_key, data, timeout=60 * 60 * 24)  # 24h
        return Response(data)


class PanchayatListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="List panchayats for a taluk",
        manual_parameters=[
            openapi.Parameter(
                "taluk_id", openapi.IN_PATH, type=openapi.TYPE_INTEGER, required=True
            )
        ],
        responses={200: LocationOptionSerializer(many=True)}
    )
    def get(self, request, taluk_id):
        cache_key = f"panchayats:list:{taluk_id}:v1"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        panchayats = Panchayat.objects.filter(taluk_id=taluk_id)
        data = [{"id": p.id, "name": p.name} for p in panchayats]
        cache.set(cache_key, data, timeout=60 * 60 * 24)  # 24h
        return Response(data)
