import { useState } from "react";
import useAuthStore from "../store/authStore";
import { useNavigate } from "react-router-dom";
import { getFingerprint } from "../utils/fingerprint";
import { BadgeCheck, KeyRound, Mail, MoveRight, UserRound } from "lucide-react";
import AnimatedRentalIllustration from "../components/AnimatedRentalIllustration";

const Register = () => {
  const { register, verifyOtp, loading, error, otpStep } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
    otp: "",
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      alert("Passwords do not match");
      return;
    }
    await register({ ...form, fingerprint: getFingerprint() });
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const success = await verifyOtp({ email: form.email, otp: form.otp });
    if (success) navigate("/login");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f8f7] p-4 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/60 bg-white/70 shadow-2xl shadow-slate-300/30 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <BadgeCheck size={14} />
              Build Your Rental Identity
            </p>
            <h1 className="mt-5 max-w-md text-4xl font-extrabold leading-tight text-slate-900">
              Start renting
              <br />
              with confidence.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
              Create your account to unlock trusted bookings, secure payments, and faster approvals.
            </p>
          </div>

          <div className="glass rounded-2xl p-3">
            <AnimatedRentalIllustration compact variant="register" />
          </div>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">REUSE & RETURN</span>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">{otpStep ? "Verify Email" : "Create Account"}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {otpStep
                ? "Enter the OTP sent to your email address."
                : "Join the platform and start listing or renting in minutes."}
            </p>

            <form onSubmit={otpStep ? handleVerifyOtp : handleRegister} className="mt-8 space-y-4">
              {!otpStep ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                      <UserRound size={16} className="text-slate-400" />
                      <input className="w-full bg-transparent px-1 py-3 text-sm outline-none" placeholder="Your full name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                      <Mail size={16} className="text-slate-400" />
                      <input className="w-full bg-transparent px-1 py-3 text-sm outline-none" type="email" placeholder="you@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                      <KeyRound size={16} className="text-slate-400" />
                      <input className="w-full bg-transparent px-1 py-3 text-sm outline-none" type="password" placeholder="Create password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm Password</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                      <KeyRound size={16} className="text-slate-400" />
                      <input className="w-full bg-transparent px-1 py-3 text-sm outline-none" type="password" placeholder="Re-enter password" onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
                    </div>
                  </label>
                </>
              ) : (
                <input
                  className="w-full rounded-xl border-2 border-teal-500 bg-white px-4 py-3 text-center text-xl font-bold tracking-[5px] outline-none"
                  placeholder="000000"
                  maxLength="6"
                  onChange={(e) => setForm({ ...form, otp: e.target.value })}
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:from-teal-700 hover:to-emerald-600 active:scale-[0.99] disabled:opacity-70"
              >
                {loading ? "..." : otpStep ? "Verify" : "Register"}
                <MoveRight size={15} />
              </button>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 py-2 text-xs text-red-500">{error}</p>}
            </form>

            <p className="mt-5 text-xs text-slate-500">
              Have an account?{" "}
              <span onClick={() => navigate("/login")} className="cursor-pointer font-semibold text-teal-700 hover:underline">
                Log In
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
