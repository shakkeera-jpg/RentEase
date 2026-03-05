
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from profiles.models import UserProfile
from .serializers import AdminUserVerificationSerializer

class PendingVerificationListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        pending_profiles = UserProfile.objects.filter(verification_status="PENDING")
        serializer = AdminUserVerificationSerializer(pending_profiles, many=True)
        return Response(serializer.data)

class ApproveRejectVerificationView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, profile_id):
        try:
            profile = UserProfile.objects.get(id=profile_id)
            new_status = request.data.get("status") 
            reason = request.data.get("rejection_reason", "")

            if new_status not in ["APPROVED", "REJECTED"]:
                return Response({"error": "Invalid status"}, status=400)

            profile.verification_status = new_status
            profile.rejection_reason = reason
            profile.save()

            return Response({"message": f"User status updated to {new_status}"})
        except UserProfile.DoesNotExist:
            return Response({"error": "Profile not found"}, status=404)