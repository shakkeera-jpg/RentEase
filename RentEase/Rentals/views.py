from django.shortcuts import get_object_or_404
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from assets.models import Asset
from assets.serializers import AssetSerializer


class PublicAssetAPIView(APIView):

    @swagger_auto_schema(
        operation_summary="List public assets or fetch a single public asset",
        responses={200: openapi.Response("Asset list or asset detail")}
    )
    def get(self, request, pk=None):
        if pk:
            asset = get_object_or_404(Asset, pk=pk)
            serializer = AssetSerializer(asset)
            return Response(serializer.data)

        assets = Asset.objects.all()
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)
