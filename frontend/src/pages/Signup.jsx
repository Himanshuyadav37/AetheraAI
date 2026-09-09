import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Sparkles, ArrowRight, Bot, BrainCircuit, Code2, MessageSquare } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./Auth.css";

function Signup() {
  const { user, loginWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/workspace");
    }
  }, [user, navigate]);

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
      setError(err.response?.data?.detail || "Google login failed. Please try again.");
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
        setError("Failed to open Google signup. Please try again.");
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
        setError("Failed to open Google signup. Please try again.");
      }
    } else {
      setError("Google Sign-Up is initializing. Please try again in a moment.");
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
    <div className="auth-page">
      <div className="auth-background">
        <div className="blur blur1"></div>
        <div className="blur blur2"></div>
      </div>

      <div className="auth-left">
        <div className="brand-badge"><Sparkles size={15} /><span>NexusAI AI Operating System</span></div>
        <h1>Create with <span>AI Agents</span></h1>
        <p>Build intelligent applications using NexusAI's ecosystem of specialized AI agents for engineering, research, automation and education.</p>
        <div className="feature-grid">
          <div className="feature-card"><Code2 size={22} /><div><h3>Engineer AI</h3><p>Generate complete full-stack applications.</p></div></div>
          <div className="feature-card"><MessageSquare size={22} /><div><h3>Conversational AI</h3><p>Chat naturally with persistent memory.</p></div></div>
          <div className="feature-card"><BrainCircuit size={22} /><div><h3>Research AI</h3><p>Deep research with tools and citations.</p></div></div>
          <div className="feature-card"><Bot size={22} /><div><h3>Automation AI</h3><p>Automate repetitive tasks intelligently.</p></div></div>
        </div>
        <div className="system-status"><div className="status-dot"></div><span>Platform Status</span><strong>Ready</strong></div>
      </div>

      <div className="auth-right">
        <div className="auth-card auth-card--compact">
          <div className="login-icon login-icon--sm" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "none", border: "none" }}>
            <svg
              width="46"
              height="46"
              viewBox="0 0 100 100"
              style={{
                color: "#ffffff",
                filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.25))"
              }}
            >
              {/* Outer Nodes & Branches */}
              <line x1="50" y1="30" x2="50" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="41.3" y1="35" x2="36.3" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="34" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="58.7" y1="35" x2="63.7" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="66" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="32.7" y1="45" x2="22" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="32.7" y1="55" x2="22" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="67.3" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="82" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="67.3" y1="55" x2="78" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="82" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="41.3" y1="65" x2="36.3" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="34" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="58.7" y1="65" x2="63.7" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="66" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="50" y1="70" x2="50" y2="82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="85" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

              {/* Central Broken Hexagon */}
              <path d="M 50 30 L 67.3 40 L 67.3 60 L 50 70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M 45 32.5 L 32.7 40 L 32.7 60 L 45 67.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Floating Square dots */}
              <rect x="16" y="29" width="4" height="4" fill="currentColor" />
              <rect x="80" y="67" width="4" height="4" fill="currentColor" />

              {/* Core Text 'NFT' */}
              <text x="50" y="56" fontFamily="system-ui, sans-serif" fontSize="16" fontWeight="bold" fill="currentColor" textAnchor="middle" letterSpacing="0.2">NFT</text>
            </svg>
          </div>

          <div className="auth-header auth-header--sm">
            <h2>Create Account</h2>
            <p>Join NexusAI and start building with AI.</p>
          </div>



          {error && (
            <div className="auth-error"><ShieldCheck size={16} /><span>{error}</span></div>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-form--compact">
            <div className="form-group form-group--sm">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Sending OTP..." : <><span>Continue with Email</span><ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="divider"><span>OR</span></div>

          <button
            type="button"
            className="auth-button google-auth-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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

          <div className="auth-footer" style={{ marginTop: "16px" }}>
            <p>Already have an account?</p>
            <Link to="/login">Sign In</Link>
          </div>

          <div className="powered-by-nft" style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.35)",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            paddingTop: "12px"
          }}>
            Powered & Managed by <strong style={{ color: "rgba(255, 255, 255, 0.7)" }}>NexusAI Technologies (NFT)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;