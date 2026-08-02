import axios from "axios";

export const getBaseURL = () => {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1" ||
     window.location.hostname.startsWith("192.168."))
  ) {
    return import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  }
  return "https://himanshuydvv-neuroforge-backend.hf.space";
};

const api = axios.create({
  baseURL: getBaseURL()
});

// Automatically inject Authorization header if JWT token is stored locally
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;