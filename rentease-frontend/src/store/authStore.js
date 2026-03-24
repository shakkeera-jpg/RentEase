import { create } from "zustand";
import api from "../api/axios";
import { registerAPI, verifyOtpAPI, loginAPI, googleLoginAPI } from "../api/auth.api";
import useProfileStore from "./ProfileStore";

const extractApiError = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (payload.error) return payload.error;
  if (payload.detail) return payload.detail;
  if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length > 0) {
    return payload.non_field_errors[0];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const useAuthStore = create((set, get) => ({
  isAuthenticated: !!localStorage.getItem("access"),
  user: localStorage.getItem("name") || null,
  trustScore: localStorage.getItem("trust_score")
    ? Number(localStorage.getItem("trust_score"))
    : null,
  loading: false,
  error: null,
  otpStep: false,
  tempEmail: null,
  mfaRequired: false,


  register: async (data) => {
    try {
      set({ loading: true, error: null });
      const res = await registerAPI(data);
      set({ otpStep: true, loading: false });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err.response?.data, "Registration failed"),
        loading: false,
      });
      return false;
    }
  },

  verifyOtp: async (data) => {
    try {
      set({ loading: true, error: null });
      await verifyOtpAPI(data);
      set({ otpStep: false, loading: false });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err.response?.data, "OTP verification failed"),
        loading: false,
      });
      return false;
    }
  },



  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const res = await loginAPI(credentials);
      set({ loading: false });
      if (res.data.mfa_required) {
        set({ tempEmail: res.data.email, mfaRequired: true });
        return { success: true, mfaRequired: true, data: res.data };
      }

      if (res.data.agreement_required) {
        set({ tempEmail: res.data.email });
        return { success: true, agreementRequired: true, data: res.data };
      } else {
        if (typeof res.data.trust_score === "number") {
          localStorage.setItem("trust_score", String(res.data.trust_score));
          set({ trustScore: res.data.trust_score });
        }
        localStorage.setItem("name", res.data.name);
        localStorage.setItem("name", res.data.name);

        set({
          isAuthenticated: true,
          user: res.data.name
        });
        return { success: true, agreementRequired: false, data: res.data };
      }
    } catch (err) {
      const errorData = err.response?.data;
      set({
        loading: false,
        error: extractApiError(errorData, "Login failed"),
      });
      return { success: false, data: errorData };
    }
  },

  verifyMfaLogin: async (email, otp) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("verify-login/", { email, otp });
      set({ loading: false, isAuthenticated: true, mfaRequired: false, tempEmail: null });
      return { success: true, data: res.data };
    } catch (err) {
      set({
        loading: false,
        error: extractApiError(err.response?.data, "Invalid MFA code"),
      });
      return { success: false };
    }
  },

  acceptAgreement: async () => {
    const email = get().tempEmail;
    if (!email) {
      set({ error: "No email found. Please login again." });
      return { success: false };
    }

    set({ loading: true });
    try {

      const res = await api.post("auth/accept-agreement/", { email });

      set({ loading: false, tempEmail: null, isAuthenticated: true });
      return { success: true, data: res.data };
    } catch (err) {
      set({
        loading: false,
        error: extractApiError(err.response?.data, "Failed to accept agreement"),
      });
      return { success: false };
    }
  },

  googleLogin: async (data) => {
    set({ loading: true, error: null });

    try {
      const res = await googleLoginAPI(data);
      set({ loading: false });

      if (res.data.agreement_required) {
        set({ tempEmail: res.data.email });
        return { success: true, agreementRequired: true, data: res.data };
      } else {
        // Let the login page store tokens + set auth state consistently.
        return { success: true, agreementRequired: false, data: res.data };
      }

    } catch (err) {
      const errorData = err.response?.data;
      set({
        loading: false,
        error: extractApiError(errorData, "Google login failed"),
      });
      return { success: false, data: errorData };
    }
  },


  forgotPassword: async (email) => {
    try {
      await api.post("forgot-password/", { email });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: extractApiError(err.response?.data, "Failed to send OTP"),
      };
    }
  },

  resetPassword: async (data) => {
    try {

      await api.post("reset-password/", data);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: extractApiError(err.response?.data, "Password reset failed"),
      };
    }
  },

  logout: () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    localStorage.removeItem("trust_score");
    useProfileStore.getState().resetProfile();
    set({ user: null, isAuthenticated: false });
  }

}));


export default useAuthStore;
