import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import {
  canAccessGeneralRoutes,
  isProfileCompleted,
  needsVerificationUpload,
} from "../utils/profileStatus";

const allowedWhileIncomplete = new Set([
  "/profile",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/agreement",
  "/verify-mfa-login",
  "/admin-verify-otp",
]);

const ProfileCompletionGate = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { profile, fetchProfile, hydrated, loading } = useProfileStore();

  useEffect(() => {
    if (isAuthenticated && !hydrated && !loading) {
      fetchProfile();
    }
  }, [isAuthenticated, hydrated, loading, fetchProfile]);

  useEffect(() => {
    if (!isAuthenticated || !hydrated || !profile) return;

    const path = location.pathname;
    if (path.startsWith("/admin")) return;

    if (!isProfileCompleted(profile) && !allowedWhileIncomplete.has(path)) {
      navigate("/profile", { replace: true });
      return;
    }

    if (needsVerificationUpload(profile) && path !== "/profile") {
      navigate("/profile", { replace: true });
      return;
    }

    if (canAccessGeneralRoutes(profile) && path === "/profile") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, hydrated, profile, location.pathname, navigate]);

  return children;
};

export default ProfileCompletionGate;
