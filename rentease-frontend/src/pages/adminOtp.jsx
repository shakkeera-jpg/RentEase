import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { KeyRound, MoveRight, ShieldCheck } from "lucide-react";

const AdminOtp = () => {
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();
  const email = localStorage.getItem("admin_email");

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("admin-verify-otp/", { email, otp });

      localStorage.setItem("access", res.data.tokens.access);
      localStorage.setItem("refresh", res.data.tokens.refresh);
      localStorage.setItem("role", "ADMIN");
      if (res.data.name) localStorage.setItem("name", res.data.name);
      if (res.data.email) localStorage.setItem("username", res.data.email);

      localStorage.removeItem("admin_email");

      navigate("/admin/verification");
    } catch (err) {
      alert(err.response?.data?.error || "Invalid OTP");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8f7] p-4">
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/75 p-8 shadow-2xl shadow-slate-300/30 backdrop-blur-xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
          <ShieldCheck size={14} />
          Admin Security
        </p>

        <h2 className="mt-4 text-2xl font-extrabold text-slate-900">OTP Verification</h2>
        <p className="mt-2 text-sm text-slate-500">Enter the 6-digit OTP sent to <span className="font-semibold text-slate-700">{email}</span></p>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
            <KeyRound size={16} className="text-slate-400" />
            <input className="w-full bg-transparent px-1 py-3 text-center text-lg tracking-[0.35em] outline-none" type="text" placeholder="000000" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)} required />
          </div>

          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:from-teal-700 hover:to-emerald-600">
            Verify & Login
            <MoveRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminOtp;
