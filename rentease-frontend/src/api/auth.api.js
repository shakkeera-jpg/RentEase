import api from "./axios";


export const registerAPI = (data) =>
  api.post("register/", data);


export const verifyOtpAPI = (data) =>
  api.post("verify-email-otp/", data);


export const loginAPI = (data) =>
  api.post("login/", data);

export const googleLoginAPI = (data) => {
  return api.post("auth/google/", data);
};
