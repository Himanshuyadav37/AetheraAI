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
      const res = await api.post("/auth/google-login", { id_token: response.credential });
      const { access_token, user: userData } = res.data;
      loginWithToken(access_token, userData);
      sessionStorage.setItem("show_login_welcome", "true");
      navigate("/workspace");
    } catch (err) {
      setError(err.response?.data?.detail || "Google login failed");
    }
    setLoading(false);
  };

  useEffect(() => {
    const client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!client_id) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({ client_id, callback: handleGoogleCallback, ux_mode: "popup" });
        const overlay = document.getElementById("google-signup-overlay");
        if (overlay) window.google.accounts.id.renderButton(overlay, { type: "standard", size: "large", width: overlay.offsetWidth || 360 });
      }
    };
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

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
        <div className="brand-badge"><Sparkles size={15} /><span>NeuroForge AI Operating System</span></div>
        <h1>Create with <span>AI Agents</span></h1>
        <p>Build intelligent applications using NeuroForge's ecosystem of specialized AI agents for engineering, research, automation and education.</p>
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
            <p>Join NeuroForge and start building with AI.</p>
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

          <div style={{ position: "relative", width: "100%" }}>
            <button type="button" className="google-auth-btn" style={{ pointerEvents: "none" }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo" />
              <span>Continue with Google</span>
            </button>
            <div id="google-signup-overlay" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden", opacity: 0.01, cursor: "pointer" }} />
          </div>

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
            Powered & Managed by <strong style={{ color: "rgba(255, 255, 255, 0.7)" }}>NeuroForge Technologies (NFT)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;