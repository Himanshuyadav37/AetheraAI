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
  return "https://himanshuydvv-nexusai-backend.hf.space";
};

const api = axios.create({
  baseURL: getBaseURL()
});

export default api;