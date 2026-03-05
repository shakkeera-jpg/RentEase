
from rest_framework import serializers
from profiles.models import UserProfile 

class AdminUserVerificationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id", 
            "email", 
            "phone", 
            "panchayat", 
            "address", 
            "id_document", 
            "verification_status", 
            "rejection_reason",
            "created_at"
        ]