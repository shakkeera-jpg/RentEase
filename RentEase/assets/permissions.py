from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsProfileApproved(BasePermission):
    message = "Your verification is not approved by admin."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not hasattr(user, "profile"):
            return False

        return user.profile.verification_status == "APPROVED"


class IsOwner(BasePermission):
    message = "You are not allowed to edit this product."

    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user
