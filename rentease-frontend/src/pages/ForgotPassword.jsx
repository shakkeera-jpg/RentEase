import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const { forgotPassword, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await forgotPassword(email);
    if (res.success) {
      alert("OTP sent to your email!");
      navigate("/reset-password", { state: { email } });
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="glass w-full max-w-md rounded-3xl p-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">Forgot Password</h2>
          <p className="mt-2 text-sm text-slate-500">Enter your email to receive a 6-digit OTP.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="email" placeholder="name@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <button type="submit" disabled={loading} className={`w-full rounded-xl py-3.5 text-sm font-bold text-white ${loading ? "bg-slate-400" : "bg-gradient-to-r from-teal-600 to-emerald-500 shadow-lg shadow-emerald-200"}`}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>

        <div className="mt-7 text-center">
          <button onClick={() => navigate("/login")} className="text-sm font-semibold text-teal-700 hover:underline">Back to Login</button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
