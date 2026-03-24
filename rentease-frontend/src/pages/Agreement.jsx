import React from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import { canAccessGeneralRoutes } from "../utils/profileStatus";

const Agreement = () => {
  const navigate = useNavigate();
  const { acceptAgreement, loading, tempEmail } = useAuthStore();
  const { fetchProfile } = useProfileStore();

  const handleAccept = async () => {
    const result = await acceptAgreement();

    if (result && result.success) {
      localStorage.setItem("access", result.data.tokens.access);
      localStorage.setItem("refresh", result.data.tokens.refresh);
      localStorage.setItem("role", "USER");
      if (tempEmail) localStorage.setItem("username", tempEmail);

      const profileData = await fetchProfile();

      navigate(canAccessGeneralRoutes(profileData) ? "/" : "/profile");
    } else {
      alert("Failed to accept agreement. Please try logging in again.");
      navigate("/login");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-800">Terms and Conditions</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          To provide you with a secure experience, please review and accept our updated terms of service to complete your login.
        </p>

        <div className="mt-7 space-y-3">
          <button
            onClick={handleAccept}
            disabled={loading}
            className={`w-full rounded-xl py-3.5 text-sm font-semibold text-white ${loading ? "bg-slate-400" : "bg-gradient-to-r from-teal-600 to-emerald-500 shadow-lg shadow-emerald-200"}`}
          >
            {loading ? "Processing..." : "I Accept & Login"}
          </button>

          <button onClick={() => navigate("/login")} className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Agreement;
