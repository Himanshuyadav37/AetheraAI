import axios from "axios";

export const getBaseURL = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
  const configuredUrlIsLocal = configuredApiUrl && (
    configuredApiUrl.includes("localhost") ||
    configuredApiUrl.includes("127.0.0.1")
  );

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1" ||
     window.location.hostname.startsWith("192.168."))
  ) {
    return configuredApiUrl || "http://127.0.0.1:8000";
  }

  return configuredApiUrl && !configuredUrlIsLocal
    ? configuredApiUrl
    : "https://himanshuydvv-neuroforge-backend.hf.space";
};

export function openAuthenticatedEventSource(url) {
  const controller = new AbortController();
  const stream = {
    onmessage: null,
    onerror: null,
    close: () => controller.abort(),
  };

  (async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Failed to initialize stream: ${response.statusText || response.status}`);
        error.status = response.status;
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response body is unavailable");
      const decoder = new TextDecoder();
      let buffer = "";
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (data && stream.onmessage) stream.onmessage({ data });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && stream.onerror) stream.onerror(error);
    }
  })();

  return stream;
}

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

// Handle 401 Unauthorized responses globally
// If the backend returns 401, the stored token is stale/invalid.
// Clear it and notify the AuthContext to redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        // Only force logout if we actually had a token (not anonymous requests)
        console.warn("[API] 401 Unauthorized — clearing stale token and logging out.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Dispatch event so AuthContext / any listener can react (redirect to login)
        window.dispatchEvent(new CustomEvent("auth:logout", {
          detail: { reason: "token_expired" }
        }));
      }
    } else if (
      error.response?.status === 403 &&
      typeof error.response?.data?.detail === "string" &&
      error.response.data.detail.toLowerCase().includes("blocked")
    ) {
      const currentToken = localStorage.getItem("token");
      if (currentToken) {
        console.warn("[API] 403 Account Blocked — logging out immediately.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:logout", {
          detail: {
            reason: "account_blocked",
            message: error.response.data.detail
          }
        }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
