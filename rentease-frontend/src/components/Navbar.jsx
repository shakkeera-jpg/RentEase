import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import NotificationBell from "./NotificationBell";
import { Home, LogIn, LogOut, Menu, MessageCircle, PackageSearch } from "lucide-react";
import { connectSocket, disconnectSocket } from "../services/Socket";
import useUnreadMessages from "../hooks/useUnreadMessages";
import { addCacheBuster, resolveMediaUrl } from "../utils/mediaUrl";
import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase";
import api from "../api/axios";



const Navbar = ({ showMenuToggle = false, onMenuToggle }) => {
  const navigate = useNavigate();
  const unreadCount = useUnreadMessages();
  const { logout, isAuthenticated, user, trustScore } = useAuthStore();
  const { profile, fetchProfile, profilePhotoVersion, hydrated, loading } = useProfileStore();
  const userRole = localStorage.getItem("role");
  const storedName = localStorage.getItem("name");
  const displayName = profile?.name || user || storedName || "User";
  const avatarChar = displayName?.charAt(0)?.toUpperCase() || userRole?.[0]?.toUpperCase() || "U";
  const [avatarRefreshAttempted, setAvatarRefreshAttempted] = useState(false);
  const profilePhotoUrl = addCacheBuster(
    resolveMediaUrl(profile?.profile_photo),
    profilePhotoVersion
  );
  const effectiveTrustScore =
    typeof profile?.trust_score === "number"
      ? profile.trust_score
      : typeof trustScore === "number"
        ? trustScore
        : localStorage.getItem("trust_score")
          ? Number(localStorage.getItem("trust_score"))
          : null;

  useEffect(() => {
    if (isAuthenticated && !hydrated && !loading) {
      fetchProfile();
    }
  }, [isAuthenticated, hydrated, loading, fetchProfile]);

  useEffect(() => {
    if (avatarRefreshAttempted) {
      setAvatarRefreshAttempted(false);
    }
  }, [profile?.profile_photo]);

  useEffect(() => {
    const accessToken = localStorage.getItem("access");
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
    }
    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let unsubscribe = null;
    const setup = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;

        const fcmToken = await getToken(messaging, { vapidKey });
        if (!fcmToken) return;

        const stored = localStorage.getItem("fcm_token");
        if (stored !== fcmToken) {
          await api.post("save-fcm-token/", { device_token: fcmToken });
          localStorage.setItem("fcm_token", fcmToken);
        }

        unsubscribe = onMessage(messaging, (payload) => {
          const eventType = payload?.data?.event_type;
          if (eventType === "RENT_REQUEST_CREATED") window.dispatchEvent(new Event("new_request"));
          if (eventType === "RENT_REQUEST_APPROVED") window.dispatchEvent(new Event("request_approved"));
          if (eventType === "RENT_REQUEST_REJECTED") window.dispatchEvent(new Event("request_rejected"));
          if (eventType === "CHAT_MESSAGE" || eventType === "NEW_MESSAGE" || eventType === "MESSAGE_RECEIVED") {
            window.dispatchEvent(new Event("chat_message"));
          }
          window.dispatchEvent(new Event("new_notification"));
          window.dispatchEvent(new Event("realtime_update"));
        });
      } catch (error) {
        console.error("FCM setup error:", error?.response?.data || error?.message || error);
      }
    };

    setup();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const handleAvatarError = async () => {
    if (avatarRefreshAttempted || !isAuthenticated) return;
    setAvatarRefreshAttempted(true);
    await fetchProfile({ force: true });
  };

  return (
    <header className="sticky top-0 z-[1000] border-b border-white/40 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[74px] w-full max-w-[1400px] items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          {showMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 shadow-sm lg:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={18} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-md shadow-teal-200">
              R
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">RentEase</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-teal-50 hover:text-teal-700">
            <Home size={16} />
            <span className="hidden md:inline">Home</span>
          </Link>
          <Link to="/products" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-teal-50 hover:text-teal-700">
            <PackageSearch size={16} />
            <span className="hidden md:inline">Products</span>
          </Link>
          <Link to="/messages" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-teal-50 hover:text-teal-700">
            <div className="relative">
              <MessageCircle size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="hidden md:inline">Messages</span>
          </Link>

          {isAuthenticated ? (
            <>
              <div className="ml-2 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-sm font-bold text-white">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      onError={handleAvatarError}
                    />
                  ) : (
                    avatarChar
                  )}
                </div>

                <div className="flex flex-col pr-1">
                  <span className="text-sm font-bold leading-tight text-slate-800">{displayName}</span>
                  <span className="text-[11px] font-medium capitalize text-slate-400">{userRole?.toLowerCase()}</span>
                  {typeof effectiveTrustScore === "number" && (
                    <span className="text-[11px] font-semibold text-emerald-700">AI Score: {effectiveTrustScore}</span>
                  )}
                </div>
                <NotificationBell />
              </div>

              <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]">
                <LogOut size={15} />
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition-all hover:from-teal-700 hover:to-emerald-600">
              <LogIn size={15} />
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
