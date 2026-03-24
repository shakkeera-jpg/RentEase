from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from drf_yasg.utils import swagger_auto_schema

from .models import District, Taluk, Panchayat
from .serializers import (
    ProfileSerializer,
    VerificationSerializer
)
from .permissions import IsBasicProfileCompleted




class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request):
        profile = request.user.profile
        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Profile completed successfully",
                "data": serializer.data
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class VerificationView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBasicProfileCompleted
    ]

    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile = request.user.profile
        serializer = VerificationSerializer(profile)
        return Response(serializer.data)

    @swagger_auto_schema(
        request_body=VerificationSerializer,
        responses={201: "ID uploaded"}
    )
    def put(self, request):
        profile = request.user.profile

        serializer = VerificationSerializer(
            profile,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Verification submitted successfully"
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class DistrictListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        districts = District.objects.all().order_by("name")
        return Response([
            {"id": d.id, "name": d.name}
            for d in districts
        ])


class TalukListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, district_id):
        taluks = Taluk.objects.filter(district_id=district_id)
        return Response([
            {"id": t.id, "name": t.name}
            for t in taluks
        ])


class PanchayatListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, taluk_id):
        panchayats = Panchayat.objects.filter(taluk_id=taluk_id)
        return Response([
            {"id": p.id, "name": p.name}
            for p in panchayats
        ])
