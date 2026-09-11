import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(userData));
      
      api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Login failed"
      };
    }
  };

  const signup = async (username, email, password) => {
    try {
      await api.post("/auth/register", { username, email, password });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Signup failed"
      };
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const response = await api.post("/auth/google-login", { id_token: idToken });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(userData));
      
      api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      setUser(userData);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Google authentication failed"
      };
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTitle, setAuthModalTitle] = useState("Sign In to Continue");
  const [authModalSubtitle, setAuthModalSubtitle] = useState("Access autonomous agents, RAG knowledge, and project workspaces.");
  const [pendingAction, setPendingAction] = useState(null);

  const openAuthModal = (callback, title, subtitle) => {
    if (callback && typeof callback === "function") {
      setPendingAction(() => callback);
    } else {
      setPendingAction(null);
    }
    if (title) setAuthModalTitle(title);
    if (subtitle) setAuthModalSubtitle(subtitle);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setPendingAction(null);
  };

  const requireAuth = (callback, title, subtitle) => {
    if (user) {
      if (callback && typeof callback === "function") {
        callback();
      }
      return true;
    }
    openAuthModal(callback, title, subtitle);
    return false;
  };

  const loginWithToken = (access_token, userData) => {
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(userData);
    setIsAuthModalOpen(false);

    if (pendingAction && typeof pendingAction === "function") {
      try {
        pendingAction();
      } catch (err) {
        console.error("Error running pending post-auth action:", err);
      }
      setPendingAction(null);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        loginWithGoogle,
        signup,
        logout,
        loginWithToken,
        isAuthModalOpen,
        setIsAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        requireAuth,
        authModalTitle,
        authModalSubtitle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
