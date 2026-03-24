from rest_framework.permissions import BasePermission


class IsBasicProfileCompleted(BasePermission):
    message = "Complete basic profile before verification."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.is_completed
        )


class IsVerificationApproved(BasePermission):
    message = (
        "Complete profile and get verification approved before accessing this feature"
    )

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if not hasattr(user, "profile") or not user.profile.is_completed:
            return False
        if not hasattr(user, "verification"):
            return False
        return user.verification.status == "APPROVED"
