import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Sparkles, ArrowRight, Bot, BrainCircuit, Code2, MessageSquare, Sun, Moon, Lock, CheckCircle2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./Auth.css";

function Login() {
  const { user, loginWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLight, setIsLight] = useState(() => document.body.classList.contains("light"));
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/workspace");
    }
  }, [user, navigate]);

  const toggleTheme = () => {
    const nextLight = !isLight;
    setIsLight(nextLight);
    if (nextLight) {
      document.body.classList.add("light");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.body.classList.remove("light");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  };

  const handleGoogleCallback = async (response) => {
    setError("");
    setLoading(true);
    try {
      const token = response.credential || response.access_token;
      const res = await api.post("/auth/google-login", { id_token: token });
      const { access_token, user: userData } = res.data;
      loginWithToken(access_token, userData);
      sessionStorage.setItem("show_login_welcome", "true");
      navigate("/workspace");
    } catch (err) {
      setError(err.response?.data?.detail || "Google authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID || "952942649756-9cq0su8134k48mhnjss7aojtr5dlilpj.apps.googleusercontent.com";
    if (!client_id) {
      setError("Google authentication client is not configured.");
      return;
    }

    setError("");
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id,
          scope: "email profile openid",
          callback: (tokenResponse) => {
            if (tokenResponse?.access_token) {
              handleGoogleCallback(tokenResponse);
            } else if (tokenResponse?.error) {
              setError(tokenResponse.error_description || "Google authorization was cancelled.");
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (err) {
        console.error("OAuth client error:", err);
        setError("Failed to open Google login. Please try again.");
      }
    } else if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id,
          callback: handleGoogleCallback,
          auto_select: false,
        });
        window.google.accounts.id.prompt();
      } catch (err) {
        console.error("GSI prompt error:", err);
        setError("Failed to open Google login. Please try again.");
      }
    } else {
      setError("Google Sign-In is initializing. Please try again in a moment.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className={`auth-page ${isLight ? "light" : ""}`}>
      {/* Top Floating Controls */}
      <div className="auth-topbar-controls">
        <button 
          type="button" 
          className="auth-theme-toggle" 
          onClick={toggleTheme}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          aria-label="Toggle Theme"
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
          <span>{isLight ? "Dark" : "Light"}</span>
        </button>
      </div>

      <div className="auth-background">
        <div className="blur blur1"></div>
        <div className="blur blur2"></div>
      </div>

      {/* Left Value Showcase */}
      <div className="auth-left">
        <div className="brand-badge">
          <Sparkles size={15} />
          <span>NexusAI Enterprise OS 2.5</span>
        </div>
        
        <h1 className="auth-hero-heading">
          The Autonomous <span>AI Platform</span> for Modern Teams
        </h1>
        
        <p className="auth-hero-desc">
          Single unified intelligence workspace combining specialized autonomous agents, RAG vector knowledge, custom agent builders, and team collaboration.
        </p>
        
        <div className="feature-grid">
          <div className="feature-card">
            <Code2 size={20} />
            <div>
              <h3>Engineer AI</h3>
              <p>Full-stack project scaffolding & auto-debug</p>
            </div>
          </div>
          <div className="feature-card">
            <MessageSquare size={20} />
            <div>
              <h3>Conversational AI</h3>
              <p>Instant grounding with linked vector memories</p>
            </div>
          </div>
          <div className="feature-card">
            <BrainCircuit size={20} />
            <div>
              <h3>Research AI</h3>
              <p>Deep web intelligence & automated syntheses</p>
            </div>
          </div>
          <div className="feature-card">
            <Bot size={20} />
            <div>
              <h3>Automation AI</h3>
              <p>End-to-end task automation & tool calling</p>
            </div>
          </div>
        </div>

        <div className="auth-security-badges">
          <div className="security-badge-item">
            <CheckCircle2 size={13} />
            <span>SOC2 Type II Certified</span>
          </div>
          <div className="security-badge-item">
            <Lock size={13} />
            <span>256-Bit TLS Encryption</span>
          </div>
          <div className="security-badge-item">
            <ShieldCheck size={13} />
            <span>Zero Data Retention</span>
          </div>
        </div>
      </div>

      {/* Right Login Card */}
      <div className="auth-right">
        <div className="auth-card auth-card--compact">
          <div className="auth-card-header">
            <div className="auth-brand-wordmark">NEXUSAI</div>
            <h2>Sign In to Workspace</h2>
            <p>Enter your work email to receive a passwordless OTP</p>
          </div>

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-form--compact">
            <div className="form-group form-group--sm">
              <label>Work Email Address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? (
                <span>Dispatching OTP...</span>
              ) : (
                <>
                  <span>Continue with Email</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <button
            type="button"
            className="auth-button google-auth-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="auth-footer">
            <p>Don't have an enterprise account?</p>
            <Link to="/signup">Create Account</Link>
          </div>

          <div className="auth-security-footer">
            <span>🔒 Enterprise Grade 256-bit Encryption • ISO 27001</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;