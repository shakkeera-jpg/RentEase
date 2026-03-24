import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import api from "../api/axios";

const SetupMFA = () => {
  const [qrCode, setQrCode] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const getQR = async () => {
      try {
        const res = await api.post("generate-qr/", {});
        setQrCode(res.data.qr_code);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setError("Session expired. Please login again and retry.");
        } else {
          setError("Failed to load QR code. Please try again.");
        }
      }
    };
    getQR();
  }, []);

  const handleVerifyAndEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const normalizedOtp = (otp || "").toString().replace(/\D/g, "").slice(0, 6);
      await api.post("verify-setup/", { otp: normalizedOtp });
      alert("MFA Enabled Successfully!");
      navigate("/profile");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError("Session expired. Please login again and retry.");
      } else {
        setError(err?.response?.data?.error || "Invalid OTP. Please check your Authenticator app.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="glass w-full max-w-md rounded-3xl p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto inline-flex rounded-full bg-teal-50 p-3 text-teal-700"><ShieldCheck size={28} /></div>
          <h2 className="text-2xl font-extrabold text-slate-900">Secure Your Account</h2>
          <p className="text-sm text-slate-500">Scan this QR code with your Authenticator app.</p>
        </div>

        <div className="mt-6 flex justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white p-4">
          {qrCode ? <img src={`data:image/png;base64,${qrCode}`} alt="MFA QR Code" className="h-48 w-48" /> : <div className="flex h-48 w-48 items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-300" /></div>}
        </div>

        <form onSubmit={handleVerifyAndEnable} className="mt-6 space-y-4">
          <input type="text" maxLength="6" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl font-mono tracking-[0.8em] outline-none focus:border-teal-500" placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value)} required />
          {error && <p className="text-center text-xs font-medium text-rose-600">{error}</p>}
          <button type="submit" disabled={loading || !otp} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 disabled:opacity-50">
            {loading ? "Verifying..." : "Verify & Activate"}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupMFA;
