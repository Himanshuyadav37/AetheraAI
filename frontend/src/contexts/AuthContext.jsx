import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

export const ADMIN_EMAILS = [
  "ydvhimanshu461@gmail.com",
  "admin.nexusai@gmail.com",
  "admin@nexusai.com",
  "admin@devpilot.ai",
  "ydvvhimanshu461@gmail.com",
  "himanshuydv00001@gmail.com"
];

export const checkIsAdmin = (user) => {
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  const role = (user.role || "").toLowerCase().trim();
  return Boolean(user.is_admin || role === "admin" || ADMIN_EMAILS.includes(email));
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const fetchUserProfile = async () => {
    try {
      let res;
      try {
        res = await api.get("/user-memory/profile");
      } catch (e1) {
        res = await api.get("/memory/user/profile");
      }
      const profile = res.data || {};
      setUserProfile(profile);
      
      // If user HAS completed onboarding in MongoDB, NEVER show modal again
      if (profile.onboarding_completed) {
        setIsOnboardingOpen(false);
        sessionStorage.removeItem("trigger_onboarding");
        localStorage.setItem("onboarding_dismissed", "true");
      } else {
        // User HAS NOT filled out the form -> Automatically show onboarding setup
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.warn("Could not fetch user profile:", err);
      if (sessionStorage.getItem("trigger_onboarding") === "true" || !localStorage.getItem("onboarding_dismissed")) {
        setIsOnboardingOpen(true);
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    } else {
      setUserProfile(null);
      setIsOnboardingOpen(false);
    }
  }, [user]);

  const completeOnboarding = (profileData) => {
    setUserProfile((prev) => ({ ...prev, ...profileData }));
    setIsOnboardingOpen(false);
    sessionStorage.removeItem("trigger_onboarding");
    localStorage.setItem("onboarding_dismissed", "true");
  };

  const openOnboarding = () => {
    setIsOnboardingOpen(true);
  };

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

  const loginWithToken = (access_token, userData, forceOnboarding = false) => {
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(userData);
    setIsAuthModalOpen(false);

    if (forceOnboarding) {
      sessionStorage.setItem("trigger_onboarding", "true");
      setIsOnboardingOpen(true);
    }

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
    localStorage.removeItem("onboarding_dismissed");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const isAdmin = checkIsAdmin(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAdmin,
        loading,
        userProfile,
        isOnboardingOpen,
        openOnboarding,
        completeOnboarding,
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
