import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetPassword, loading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    otp: "",
    new_password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await resetPassword(formData);
    if (res.success) {
      alert("Password reset successfully! Please login.");
      navigate("/login");
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="glass w-full max-w-[380px] rounded-3xl p-8 text-center">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">REUSE & RETURN</span>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Reset Password</h2>
        <p className="mt-2 text-xs text-slate-500">Enter the code sent to <span className="font-semibold text-slate-700">{formData.email}</span></p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input type="text" placeholder="6-digit OTP" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-teal-500" maxLength="6" onChange={(e) => setFormData({ ...formData, otp: e.target.value })} required />

          <input type="password" placeholder="New Password" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500" onChange={(e) => setFormData({ ...formData, new_password: e.target.value })} required />

          <button type="submit" disabled={loading} className="mt-2 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200">
            {loading ? "Resetting..." : "Update Password"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">Remembered your password? <span onClick={() => navigate("/login")} className="cursor-pointer font-semibold text-teal-700 hover:underline">Back to Login</span></p>
      </div>
    </div>
  );
};

export default ResetPassword;
