import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import { canAccessGeneralRoutes } from "../utils/profileStatus";

const VerifyMfaLogin = () => {
  const [otp, setOtp] = useState("");
  const { verifyMfaLogin, loading, error } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const navigate = useNavigate();
  const email = localStorage.getItem("temp_mfa_email");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await verifyMfaLogin(email, otp);
    if (res.success) {
      const { tokens, name } = res.data;
      localStorage.setItem("access", tokens.access);
      localStorage.setItem("refresh", tokens.refresh);
      localStorage.setItem("name", name);
      localStorage.setItem("username", res.data.username || res.data.email || email);
      localStorage.setItem("role", "USER");
      localStorage.removeItem("temp_mfa_email");
      const profileData = await fetchProfile();
      navigate(canAccessGeneralRoutes(profileData) ? "/" : "/profile");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="glass w-full max-w-[400px] rounded-3xl p-10 text-center">
        <h2 className="text-2xl font-extrabold text-slate-800">MFA Verification</h2>
        <p className="mt-2 text-sm text-slate-500">Open your Authenticator app and enter the 6-digit code.</p>

        {error && <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <input className="w-full rounded-xl border border-slate-200 bg-white p-4 text-center text-2xl font-mono tracking-[0.5em] outline-none focus:border-teal-500" type="text" maxLength="6" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} />

          <button className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:opacity-70" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyMfaLogin;
