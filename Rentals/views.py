from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from assets.models import Asset
from assets.serializers import AssetSerializer

class PublicAssetAPIView(APIView):
    
    def get(self, request, pk=None):
        if pk:
            asset = get_object_or_404(Asset, pk=pk)
            serializer = AssetSerializer(asset)
            return Response(serializer.data)

        assets = Asset.objects.all()
        serializer = AssetSerializer(assets, many=True)
        return Response(serializer.data)





