import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  const publicEndpoints = ["login/", "register/", "verify-email-otp/", "admin-verify-otp/","forgot-password/", 
    "reset-password/", "token/refresh/"];

  
  const isPublic = publicEndpoints.some((url) => config.url.endsWith(url));

  if (token && !isPublic) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// SimpleJWT access refresh (queue concurrent 401s so we refresh once).
const refreshClient = axios.create({
  baseURL: api.defaults.baseURL,
});

let isRefreshing = false;
let refreshQueue = [];

const resolveQueue = (error, accessToken = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(accessToken);
  });
  refreshQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (!originalRequest || status !== 401) {
      return Promise.reject(error);
    }

    // Prevent infinite loop.
    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      return Promise.reject(error);
    }

    // Don't try to refresh while hitting the refresh endpoint itself.
    const url = (originalRequest.url || "").toString();
    if (url.endsWith("token/refresh/")) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newAccess) => {
        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const res = await refreshClient.post("token/refresh/", { refresh: refreshToken });
      const newAccess = res?.data?.access;
      const newRefresh = res?.data?.refresh;

      if (!newAccess) {
        throw new Error("Refresh succeeded but no access token returned");
      }

      localStorage.setItem("access", newAccess);
      if (newRefresh) localStorage.setItem("refresh", newRefresh);

      resolveQueue(null, newAccess);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;

      return api(originalRequest);
    } catch (refreshErr) {
      resolveQueue(refreshErr, null);

      // Refresh token is invalid/expired: clear auth so app can redirect to login.
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");

      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
