import { useState } from "react";
import { 
  Sparkles, 
  Code2, 
  GraduationCap, 
  Container, 
  BrainCircuit, 
  BookOpen, 
  Briefcase, 
  ArrowRight, 
  Check, 
  User, 
  Layers, 
  Rocket, 
  Wand2 
} from "lucide-react";
import api from "../../services/api";
import "./OnboardingModal.css";

const ROLES = [
  {
    id: "Software Engineer",
    title: "Software Engineer",
    subtitle: "Full-Stack, Backend, Frontend & Systems Coder",
    icon: Code2,
    color: "#6366f1",
  },
  {
    id: "Student / Learner",
    title: "Student / Learner",
    subtitle: "Learning CS, algorithms, project building & exam prep",
    icon: GraduationCap,
    color: "#ec4899",
  },
  {
    id: "DevOps & Docker Specialist",
    title: "DevOps & Docker Specialist",
    subtitle: "Containers, CI/CD pipelines, Kubernetes & Cloud Infra",
    icon: Container,
    color: "#3b82f6",
  },
  {
    id: "Data Scientist & ML Engineer",
    title: "Data Scientist / ML Engineer",
    subtitle: "AI Models, PyTorch, PyData, ML Pipelines & Analytics",
    icon: BrainCircuit,
    color: "#10b981",
  },
  {
    id: "Teacher & Educator",
    title: "Teacher / Educator",
    subtitle: "Curriculum creation, Socratic teaching & assignment design",
    icon: BookOpen,
    color: "#f59e0b",
  },
  {
    id: "Product Manager & Founder",
    title: "Product Manager / Founder",
    subtitle: "System architecture, feature strategy & startup tech",
    icon: Briefcase,
    color: "#8b5cf6",
  },
];

const PRESET_TOOLS = [
  "Docker",
  "Python",
  "React",
  "Kubernetes",
  "FastAPI",
  "Node.js",
  "TypeScript",
  "SQL / PostgreSQL",
  "MongoDB",
  "PyTorch / AI",
  "Go",
  "Rust",
  "Linux / Bash",
  "AWS / Cloud",
];

const AI_STYLES = [
  {
    id: "Direct & Enterprise-Grade",
    title: "Direct & Enterprise-Grade",
    desc: "Production-ready, clean code with zero unnecessary fluff.",
    badge: "High Efficiency",
  },
  {
    id: "Socratic & Educational",
    title: "Socratic & Educational",
    desc: "Step-by-step breakdowns, real-world analogies & learning hints.",
    badge: "Deep Learning",
  },
  {
    id: "DevOps & Container-First",
    title: "DevOps & Container-First",
    desc: "Dockerized examples, production configs & deployment scripts.",
    badge: "Production Ready",
  },
  {
    id: "System Architecture & Design",
    title: "System Architecture & Design",
    desc: "High-level diagrams, tradeoff analysis & architectural patterns.",
    badge: "Architectural Focus",
  },
];

export default function OnboardingModal({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.username || user?.email?.split("@")[0] || "");
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [selectedTools, setSelectedTools] = useState(["Docker", "Python", "React"]);
  const [customToolInput, setCustomToolInput] = useState("");
  const [aiStyle, setAiStyle] = useState("Direct & Enterprise-Grade");
  const [saving, setSaving] = useState(false);

  const toggleTool = (tool) => {
    if (selectedTools.includes(tool)) {
      setSelectedTools(selectedTools.filter((t) => t !== tool));
    } else {
      setSelectedTools([...selectedTools, tool]);
    }
  };

  const handleAddCustomTool = (e) => {
    e.preventDefault();
    const clean = customToolInput.trim();
    if (clean && !selectedTools.includes(clean)) {
      setSelectedTools([...selectedTools, clean]);
      setCustomToolInput("");
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    const profilePayload = {
      name: name.trim() || "Nexus User",
      role: selectedRole,
      tech_stack: selectedTools,
      ai_preference: aiStyle,
      onboarding_completed: true,
    };

    try {
      try {
        await api.post("/user-memory/profile", profilePayload);
      } catch (e1) {
        await api.post("/memory/user/profile", profilePayload);
      }
    } catch (err) {
      console.warn("Could not sync profile to backend immediately:", err);
    } finally {
      setSaving(false);
      if (onComplete) {
        onComplete(profilePayload);
      }
    }
  };

  return (
    <div className="onboarding-overlay backdrop-blur-md">
      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-brand font-mono">
            <div className="onboarding-brand-badge">
              <Sparkles size={14} style={{ color: "#ffffff" }} />
              <span>NEXUSAI PERSONA INITIALIZATION</span>
            </div>
          </div>

          <div className="onboarding-progress-bar">
            <div 
              className="onboarding-progress-fill" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="onboarding-steps-indicator">
            <span className={step >= 1 ? "active" : ""}>1. Role</span>
            <span className={step >= 2 ? "active" : ""}>2. Stack</span>
            <span className={step >= 3 ? "active" : ""}>3. AI Style</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="onboarding-body">
          {step === 1 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="step-title-block">
                <h2>Welcome! Let's tailor your AI persona</h2>
                <p>How should NexusAI treat you? Tell us your primary role for customized AI responses.</p>
              </div>

              <div className="onboarding-field">
                <label className="onboarding-label">
                  <User size={14} />
                  <span>What should NexusAI call you?</span>
                </label>
                <input
                  type="text"
                  className="onboarding-input"
                  placeholder="e.g. Alex, Himanshu, Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="onboarding-field">
                <label className="onboarding-label">
                  <Briefcase size={14} />
                  <span>Select your primary role:</span>
                </label>

                <div className="roles-grid">
                  {ROLES.map((r) => {
                    const IconComp = r.icon;
                    const isSelected = selectedRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`role-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedRole(r.id)}
                      >
                        <div className="role-card-icon" style={{ color: r.color }}>
                          <IconComp size={22} />
                        </div>
                        <div className="role-card-text">
                          <span className="role-title">{r.title}</span>
                          <span className="role-subtitle">{r.subtitle}</span>
                        </div>
                        {isSelected && (
                          <div className="role-check">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="step-title-block">
                <h2>What is your primary tech stack?</h2>
                <p>NexusAI will automatically format code, dockerfiles, and CLI commands tailored to your stack.</p>
              </div>

              <div className="onboarding-field">
                <label className="onboarding-label">
                  <Layers size={14} />
                  <span>Click to select your tools & languages:</span>
                </label>

                <div className="tools-pills-wrap">
                  {PRESET_TOOLS.map((t) => {
                    const isSelected = selectedTools.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`tool-pill ${isSelected ? "active" : ""}`}
                        onClick={() => toggleTool(t)}
                      >
                        {isSelected && <Check size={12} className="pill-check" />}
                        <span>{t}</span>
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleAddCustomTool} className="custom-tool-form">
                  <input
                    type="text"
                    className="custom-tool-input"
                    placeholder="Add custom tool (e.g. Terraform, GraphQL)..."
                    value={customToolInput}
                    onChange={(e) => setCustomToolInput(e.target.value)}
                  />
                  <button type="submit" className="custom-tool-btn">
                    + Add Tool
                  </button>
                </form>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-step-view animate-fade-in">
              <div className="step-title-block">
                <h2>How should NexusAI assist you?</h2>
                <p>Choose your preferred explanation depth, code style, and AI response tone.</p>
              </div>

              <div className="ai-styles-grid">
                {AI_STYLES.map((style) => {
                  const isSelected = aiStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      className={`ai-style-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setAiStyle(style.id)}
                    >
                      <div className="ai-style-card-header">
                        <span className="ai-style-title">{style.title}</span>
                        <span className="ai-style-badge">{style.badge}</span>
                      </div>
                      <p className="ai-style-desc">{style.desc}</p>
                      {isSelected && (
                        <div className="style-check-badge">
                          <Check size={14} /> Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="persona-summary-box font-mono">
                <Wand2 size={15} className="text-purple-400" />
                <span>
                  Configured: <strong>{name || "User"}</strong> • <strong>{selectedRole}</strong> • Stack: ({selectedTools.slice(0, 4).join(", ")}{selectedTools.length > 4 ? ` +${selectedTools.length - 4}` : ""})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="onboarding-footer">
          {step > 1 ? (
            <button
              type="button"
              className="onboarding-btn-secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={() => setStep(step + 1)}
            >
              <span>Next Step</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="onboarding-btn-primary onboarding-btn-submit"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <span>Calibrating Persona...</span>
              ) : (
                <>
                  <Rocket size={17} />
                  <span>Launch NexusAI Workspace</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
