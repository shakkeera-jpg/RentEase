import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useProfileStore from "../store/ProfileStore";
import { getFingerprint } from "../utils/fingerprint";
import { GoogleLogin } from "@react-oauth/google";
import { KeyRound, Mail, MoveRight, ShieldCheck } from "lucide-react";
import AnimatedRentalIllustration from "../components/AnimatedRentalIllustration";
import { canAccessGeneralRoutes } from "../utils/profileStatus";

const Login = () => {
  const navigate = useNavigate();
  const { login, loading, error, googleLogin } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleGoogleSuccess = async (credentialResponse) => {
    const payload = {
      token: credentialResponse.credential,
      fingerprint: getFingerprint(),
    };

    const result = await googleLogin(payload);

    if (result.success) {
      if (result.data.mfa_required) {
        localStorage.setItem("temp_mfa_email", result.data.email);
        navigate("/verify-mfa-login");
        return;
      }

      if (result.agreementRequired) {
        navigate("/agreement");
        return;
      }

      const role = result.data.role || "USER";
      const tokens = result.data.tokens || {
        access: result.data.access,
        refresh: result.data.refresh,
      };
      const otp_required = result.data.otp_required;
      const name = result.data.name || result.data.full_name || "User";

      if (!tokens?.access || !tokens?.refresh) {
        console.error("Google login response missing tokens:", result.data);
        return;
      }

      if (role === "USER") {
        localStorage.clear();
        localStorage.setItem("name", name || "User");
        localStorage.setItem(
          "username",
          result.data.username || result.data.email || formData.email
        );
        localStorage.setItem("access", tokens.access);
        localStorage.setItem("refresh", tokens.refresh);
        localStorage.setItem("role", "USER");

        useAuthStore.setState({
          isAuthenticated: true,
          user: name || "User",
        });

        const profileData = await fetchProfile();
        if (typeof profileData?.trust_score === "number") {
          localStorage.setItem("trust_score", String(profileData.trust_score));
          useAuthStore.setState({ trustScore: profileData.trust_score });
        } else if (typeof result.data?.trust_score === "number") {
          localStorage.setItem("trust_score", String(result.data.trust_score));
          useAuthStore.setState({ trustScore: result.data.trust_score });
        }

        if (canAccessGeneralRoutes(profileData)) {
          navigate("/");
        } else {
          navigate("/profile");
        }
      } else if (role === "ADMIN") {
        if (otp_required === true) {
          localStorage.setItem("admin_email", result.data.email);
          navigate("/admin-verify-otp");
        } else {
          localStorage.setItem("access", tokens.access);
          localStorage.setItem("refresh", tokens.refresh);
          localStorage.setItem("role", "ADMIN");
          localStorage.setItem("name", name || result.data.name || "Admin");
          navigate("/admin/verification");
        }
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const payload = { ...formData, fingerprint: getFingerprint() };
    const result = await login(payload);

    if (result.success) {
      if (result.data.mfa_required) {
        localStorage.setItem("temp_mfa_email", result.data.email);
        navigate("/verify-mfa-login");
        return;
      }

      if (result.agreementRequired) {
        navigate("/agreement");
        return;
      }

      const { role, tokens, otp_required, name } = result.data;

      if (role === "USER") {
        localStorage.clear();
        localStorage.setItem("name", name || "User");
        localStorage.setItem(
          "username",
          result.data.username || result.data.email || formData.email
        );
        localStorage.setItem("access", tokens.access);
        localStorage.setItem("refresh", tokens.refresh);
        localStorage.setItem("role", "USER");

        useAuthStore.setState({
          isAuthenticated: true,
          user: name || "User",
        });

        const profileData = await fetchProfile();
        if (typeof profileData?.trust_score === "number") {
          localStorage.setItem("trust_score", String(profileData.trust_score));
          useAuthStore.setState({ trustScore: profileData.trust_score });
        } else if (typeof result.data?.trust_score === "number") {
          localStorage.setItem("trust_score", String(result.data.trust_score));
          useAuthStore.setState({ trustScore: result.data.trust_score });
        }

        if (canAccessGeneralRoutes(profileData)) {
          navigate("/");
        } else {
          navigate("/profile");
        }
      } else if (role === "ADMIN") {
        if (otp_required === true) {
          localStorage.setItem("admin_email", formData.email);
          navigate("/admin-verify-otp");
        } else {
          localStorage.setItem("access", tokens.access);
          localStorage.setItem("refresh", tokens.refresh);
          localStorage.setItem("role", "ADMIN");
          localStorage.setItem("name", name || "Admin");
          navigate("/admin/verification");
        }
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f8f7] p-4 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-10 h-52 w-52 rounded-full bg-teal-200/70 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-200/70 blur-3xl" />

      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/60 bg-white/70 shadow-2xl shadow-slate-300/30 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <ShieldCheck size={14} />
              Trusted Rentals
            </p>
            <h1 className="mt-5 max-w-md text-4xl font-extrabold leading-tight text-slate-900">
              Rent smarter,
              <br />
              live lighter.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
              Access quality products without ownership stress. Find what you need, when you need it.
            </p>
          </div>

          <div className="glass rounded-2xl p-3">
            <AnimatedRentalIllustration compact variant="login" />
          </div>
        </div>

        <div className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">REUSE & RETURN</span>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Welcome Back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to manage rentals, bookings, and chats.</p>

            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">{error}</div>}

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                  <Mail size={16} className="text-slate-400" />
                  <input
                    className="w-full bg-transparent px-1 py-3 text-sm outline-none"
                    type="email"
                    placeholder="you@example.com"
                    required
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500">
                  <KeyRound size={16} className="text-slate-400" />
                  <input
                    className="w-full bg-transparent px-1 py-3 text-sm outline-none"
                    type="password"
                    placeholder="Enter your password"
                    required
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </label>

              <button
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:from-teal-700 hover:to-emerald-600 active:scale-[0.99] disabled:opacity-70"
              >
                {loading ? "Logging in..." : "Login"}
                <MoveRight size={15} />
              </button>
            </form>

            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Continue with</p>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.log("Google Login Failed")} />
            </div>

            <div className="mt-6 flex items-center justify-between text-xs">
              <p className="text-slate-500">
                New here?{" "}
                <span onClick={() => navigate("/register")} className="cursor-pointer font-semibold text-teal-700 hover:underline">
                  Create account
                </span>
              </p>
              <span onClick={() => navigate("/forgot-password")} className="cursor-pointer font-semibold text-teal-700 hover:underline">
                Forgot password
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
