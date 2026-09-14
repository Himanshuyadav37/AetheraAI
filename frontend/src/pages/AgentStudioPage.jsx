import React, { useState, useEffect } from "react";
import { 
  Bot, Plus, Play, Trash2, Edit3, Share2, Code, Check, 
  Sparkles, RefreshCw, Send, Loader2, Database, Globe, Sliders 
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../services/api";
import MarkdownRenderer from "../components/education/MarkdownRenderer";
import "./AgentStudio.css";

const AVATAR_OPTIONS = ["🤖", "🧠", "💼", "⚖️", "🛡️", "📊", "🎯", "🚀", "💡", "⚡"];

const PREBUILT_TEMPLATES = [
  {
    id: "template_code_architect",
    name: "Full-Stack Code Architect",
    avatar: "🚀",
    category: "engineering",
    description: "Expert software architect for code reviews, security audits, design patterns, and debugging.",
    system_prompt: `You are an elite Full-Stack Code Architect & Senior Software Engineer.
Your goal is to assist developers with:
1. Writing clean, production-grade, type-safe, and modular code.
2. Code reviews, security vulnerability scanning, and performance optimization.
3. Microservices architecture, API design, database modeling, and system design patterns.
Provide clear code snippets, explain tradeoffs, and follow software engineering best practices.`,
    starter_prompts: [
      "Review this code snippet for security bugs & memory leaks.",
      "How do I architect a scalable multi-tenant SaaS backend?"
    ]
  },
  {
    id: "template_data_analyst",
    name: "Data Science & ML Specialist",
    avatar: "📊",
    category: "analytics",
    description: "Specialized AI for statistical analysis, Python pandas/numpy scripts, and ML modeling.",
    system_prompt: `You are a Data Science & Machine Learning Specialist.
Your goal is to assist data scientists and analysts with:
1. Data cleaning, feature engineering, and EDA (Exploratory Data Analysis) in Python.
2. Building machine learning models using Scikit-Learn, PyTorch, and TensorFlow.
3. SQL query optimization, data pipeline design, and statistical inference.
Always provide reproducible Python/SQL code and explain statistical insights clearly.`,
    starter_prompts: [
      "Write a Python pandas script to clean missing data & plot distributions.",
      "Explain the difference between XGBoost and Random Forest."
    ]
  },
  {
    id: "template_seo_expert",
    name: "SEO & Growth Marketing Expert",
    avatar: "🔍",
    category: "marketing",
    description: "Growth hacker for keyword research, content optimization, meta tags, and conversion copywriting.",
    system_prompt: `You are an expert SEO & Growth Marketing Specialist.
Your goal is to help creators and marketers boost organic rankings and drive conversions by:
1. Generating high-intent keyword clusters, title tags, and meta descriptions.
2. Outlining SEO-friendly blog articles, landing page copy, and conversion funnels.
3. Technical SEO auditing, schema markup (JSON-LD), and backlink strategies.
Deliver actionable, high-converting growth strategies with structured checklists.`,
    starter_prompts: [
      "Generate an SEO-optimized blog outline for AI developer tools.",
      "Write a high-converting landing page headline & meta description."
    ]
  },
  {
    id: "template_exec_assistant",
    name: "Executive Business Assistant",
    avatar: "💼",
    category: "executive",
    description: "High-productivity assistant for drafting emails, meeting briefs, proposals, and strategy memos.",
    system_prompt: `You are an Executive Business Assistant to C-suite leadership.
Your goal is to streamline executive productivity by:
1. Drafting polished, persuasive executive emails, investor updates, and proposal memos.
2. Summarizing complex strategic documents into concise bullet points.
3. Preparing agenda notes, decision matrices, and risk assessments.
Maintain an ultra-professional, diplomatic, and concise communication tone.`,
    starter_prompts: [
      "Draft a polite but firm follow-up email regarding a pending proposal.",
      "Summarize these quarterly goals into a 3-bullet executive update."
    ]
  },
  {
    id: "template_legal_advisor",
    name: "Legal & Compliance Auditor",
    avatar: "⚖️",
    category: "legal",
    description: "Specialized assistant for contract clause analysis, GDPR privacy policies, and compliance checklists.",
    system_prompt: `You are a Legal & Regulatory Compliance Advisor.
Your goal is to analyze legal documents and enterprise policies by:
1. Reviewing NDAs, SaaS Terms of Service, and Service Level Agreements (SLAs) for risk clauses.
2. Formulating GDPR, CCPA, and SOC2 compliance checklists.
3. Explaining legalese into plain, understandable terms with recommendations.
Note: Always include a standard legal disclaimer that responses are for informational purposes only.`,
    starter_prompts: [
      "What are key clauses to look out for in a vendor NDA?",
      "Create a GDPR compliance checklist for a SaaS web app."
    ]
  },
  {
    id: "template_stem_tutor",
    name: "STEM Academic Mentor",
    avatar: "🎓",
    category: "education",
    description: "Patient tutor for step-by-step guidance in mathematics, physics, and computer science.",
    system_prompt: `You are an encouraging STEM Academic Mentor & Computer Science Tutor.
Your goal is to foster deep understanding in students by:
1. Explaining complex mathematical, scientific, and algorithmic concepts step-by-step.
2. Using intuitive analogies, visual intuition, and practice problems with solutions.
3. Breaking down difficult homework problems without giving direct answers immediately.
Encourage active learning and maintain an inspiring, supportive tone.`,
    starter_prompts: [
      "Explain how Gradient Descent works using an intuitive real-world analogy.",
      "Walk me through solving quadratic equations step by step."
    ]
  }
];

function AgentStudioPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kbs, setKbs] = useState([]);
  
  // Selected / Active Agent
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    avatar: "🤖",
    category: "general",
    model: "llama-3.3-70b-versatile",
    system_prompt: "",
    temperature: 0.7,
    attached_kb_ids: [],
    starter_prompts: ["How can you help me today?", "Give me a quick overview of your capabilities."],
    is_public: true
  });

  // Sandbox Test Chat State
  const [sandboxHistory, setSandboxHistory] = useState([]);
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Share / Embed Modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStudioData();
  }, []);

  async function loadStudioData() {
    setLoading(true);
    try {
      const res = await api.get("/api/custom-agents");
      setAgents(res.data || []);
      if (res.data?.length > 0 && !selectedAgent) {
        setSelectedAgent(res.data[0]);
        resetFormWithAgent(res.data[0]);
      }

      // Fetch KBs for RAG attachment
      try {
        const orgsRes = await api.get("/rag/organizations");
        if (orgsRes.data?.length > 0) {
          const kbsRes = await api.get(`/rag/kb/${orgsRes.data[0]._id}`);
          setKbs(kbsRes.data || []);
        }
      } catch (e) {
        console.warn("Could not load KBs", e);
      }
    } catch (err) {
      console.error("Failed to load custom agents", err);
    } finally {
      setLoading(false);
    }
  }

  function resetFormWithAgent(agent) {
    setIsCreating(false);
    setFormData({
      name: agent.name || "",
      description: agent.description || "",
      avatar: agent.avatar || "🤖",
      category: agent.category || "general",
      model: agent.model || "llama-3.3-70b-versatile",
      system_prompt: agent.system_prompt || "",
      temperature: agent.temperature || 0.7,
      attached_kb_ids: agent.attached_kb_ids || [],
      starter_prompts: agent.starter_prompts?.length ? agent.starter_prompts : ["How can you assist me?"],
      is_public: agent.is_public ?? true
    });
    setSandboxHistory([
      { role: "assistant", content: `Hello! I am ${agent.name}. How can I help you today?` }
    ]);
  }

  function handleStartCreateNew() {
    setSelectedAgent(null);
    setIsCreating(true);
    setFormData({
      name: "",
      description: "",
      avatar: "🤖",
      category: "general",
      model: "llama-3.3-70b-versatile",
      system_prompt: "You are a specialized enterprise AI assistant. Answer queries accurately, professionally, and concisely.",
      temperature: 0.7,
      attached_kb_ids: [],
      starter_prompts: ["What services do you offer?", "Help me solve a problem."],
      is_public: true
    });
    setSandboxHistory([
      { role: "assistant", content: "Hello! I am your new custom assistant. Test my persona in this sandbox!" }
    ]);
    setIsStudioModalOpen(true);
  }

  async function handleSaveAgent(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      alert("Agent Name and System Prompt are required.");
      return;
    }

    setSaving(true);
    try {
      if (isCreating || !selectedAgent?.id) {
        const res = await api.post("/api/custom-agents", formData);
        setAgents([res.data, ...agents]);
        setSelectedAgent(res.data);
        setIsCreating(false);
      } else {
        const res = await api.put(`/api/custom-agents/${selectedAgent.id}`, formData);
        setAgents(agents.map(a => a.id === selectedAgent.id ? res.data : a));
        setSelectedAgent(res.data);
      }
      alert("Agent saved successfully!");
    } catch (err) {
      alert("Error saving agent: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent(agentId) {
    if (!window.confirm("Are you sure you want to delete this custom agent?")) return;
    try {
      await api.delete(`/api/custom-agents/${agentId}`);
      const updated = agents.filter(a => a.id !== agentId);
      setAgents(updated);
      if (selectedAgent?.id === agentId) {
        if (updated.length > 0) {
          setSelectedAgent(updated[0]);
          resetFormWithAgent(updated[0]);
        } else {
          handleStartCreateNew();
        }
      }
    } catch (err) {
      alert("Error deleting agent");
    }
  }

  async function handleSendSandboxMessage(e) {
    e.preventDefault();
    if (!sandboxInput.trim() || sandboxLoading) return;

    const userMsg = sandboxInput.trim();
    setSandboxInput("");
    const newHistory = [...sandboxHistory, { role: "user", content: userMsg }];
    setSandboxHistory(newHistory);
    setSandboxLoading(true);

    try {
      if (selectedAgent?.id && !isCreating) {
        const res = await api.post(`/api/custom-agents/${selectedAgent.id}/chat`, {
          prompt: userMsg,
          history: newHistory
        });
        setSandboxHistory([...newHistory, { role: "assistant", content: res.data.reply }]);
      } else {
        // Local simulation if in draft mode
        setTimeout(() => {
          setSandboxHistory([
            ...newHistory,
            { role: "assistant", content: `[${formData.name || "Draft Agent"} Simulator]: I received your test prompt: "${userMsg}". (Save this agent to test live LLM completions).` }
          ]);
          setSandboxLoading(false);
        }, 500);
        return;
      }
    } catch (err) {
      setSandboxHistory([
        ...newHistory,
        { role: "assistant", content: `⚠️ Error: ${err?.response?.data?.detail || err?.message || "Error communicating with custom agent API."}` }
      ]);
    } finally {
      setSandboxLoading(false);
    }
  }

  function handleUseTemplate(template) {
    setSelectedAgent(null);
    setIsCreating(true);
    setFormData({
      name: template.name,
      description: template.description,
      avatar: template.avatar,
      category: template.category,
      model: "llama-3.3-70b-versatile",
      system_prompt: template.system_prompt,
      temperature: 0.7,
      attached_kb_ids: [],
      starter_prompts: template.starter_prompts,
      is_public: true
    });
    setSandboxHistory([
      { role: "assistant", content: `Hello! I am ${template.name}. Test my capabilities in this live sandbox!` }
    ]);
    setIsStudioModalOpen(true);
  }

  const [activeTab, setActiveTab] = useState("templates"); // "my_agents" | "templates"

  const publicShareUrl = selectedAgent?.id ? `${window.location.origin}/chat/agent/${selectedAgent.id}` : "";
  const embedCodeSnippet = selectedAgent?.id ? `<script src="${window.location.origin}/widget.js" data-agent-id="${selectedAgent.id}"></script>` : "";

  return (
    <DashboardLayout>
      <div className="agent-studio-page">
        {/* Header */}
        <div className="studio-header">
          <div className="studio-header-title">
            <Bot className="studio-shield-icon" />
            <div>
              <h1>No-Code Custom Agent Studio</h1>
              <p>Build, customize, attach RAG knowledge, and publish custom AI bots with 1-click embed widgets.</p>
            </div>
          </div>
          <button 
            type="button" 
            className="admin-primary-btn" 
            onClick={handleStartCreateNew}
          >
            <Plus size={16} /> Create Custom Agent
          </button>
        </div>

        {/* Section Tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px" }}>
          <button
            type="button"
            style={{
              background: activeTab === "templates" ? "#ffffff" : "rgba(255, 255, 255, 0.04)",
              color: activeTab === "templates" ? "#000000" : "#a1a1aa",
              border: activeTab === "templates" ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: activeTab === "templates" ? "600" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease"
            }}
            onClick={() => setActiveTab("templates")}
          >
            <Sparkles size={14} style={{ color: activeTab === "templates" ? "#000000" : "#a1a1aa" }} /> Pre-built Templates ({PREBUILT_TEMPLATES.length})
          </button>
          <button
            type="button"
            style={{
              background: activeTab === "my_agents" ? "#ffffff" : "rgba(255, 255, 255, 0.04)",
              color: activeTab === "my_agents" ? "#000000" : "#a1a1aa",
              border: activeTab === "my_agents" ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: activeTab === "my_agents" ? "600" : "500",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease"
            }}
            onClick={() => setActiveTab("my_agents")}
          >
            <Bot size={14} style={{ color: activeTab === "my_agents" ? "#000000" : "#a1a1aa" }} /> My Custom Agents ({agents.length})
          </button>
        </div>

        {/* Pre-built Templates Gallery */}
        {activeTab === "templates" && (
          <div style={{ marginBottom: "28px" }}>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "12px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
              ⚡ 1-Click Ready Templates (Select to instantize in Studio)
            </div>
            <div className="agent-grid-list">
              {PREBUILT_TEMPLATES.map((tmpl) => (
                <div 
                  key={tmpl.id} 
                  className="agent-item-card"
                  style={{ background: "#18181b", border: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                  <div>
                    <div className="agent-card-top">
                      <div className="agent-avatar-icon" style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>{tmpl.avatar}</div>
                      <div>
                        <div className="agent-name">{tmpl.name}</div>
                        <div className="agent-category-tag">{tmpl.category}</div>
                      </div>
                    </div>
                    <div className="agent-desc">{tmpl.description}</div>
                  </div>

                  <div className="agent-card-bottom" style={{ justifyContent: "flex-end" }}>
                    <button 
                      className="admin-primary-btn" 
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                      onClick={() => handleUseTemplate(tmpl)}
                    >
                      <Sparkles size={13} /> Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing User Created Agents List */}
        {activeTab === "my_agents" && (
          <div style={{ marginBottom: "28px" }}>
            {agents.length === 0 ? (
              <div style={{ padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px dashed rgba(255,255,255,0.1)", textAlign: "center", color: "#71717a", fontSize: "13px" }}>
                No custom agents created yet. Pick a template above or click "Create Custom Agent" to get started!
              </div>
            ) : (
              <div className="agent-grid-list">
                {agents.map((agent) => (
                  <div 
                    key={agent.id} 
                    className={`agent-item-card ${selectedAgent?.id === agent.id && !isCreating ? "active" : ""}`}
                    onClick={() => {
                      setSelectedAgent(agent);
                      resetFormWithAgent(agent);
                      setIsStudioModalOpen(true);
                    }}
                  >
                    <div>
                      <div className="agent-card-top">
                        <div className="agent-avatar-icon">{agent.avatar || "🤖"}</div>
                        <div>
                          <div className="agent-name">{agent.name}</div>
                          <div className="agent-category-tag">{agent.category}</div>
                        </div>
                      </div>
                      <div className="agent-desc">{agent.description || "No description provided."}</div>
                    </div>

                    <div className="agent-card-bottom">
                      <span>{agent.usage_count || 0} chats run</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button 
                          className="admin-refresh-btn" 
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent);
                            setShareModalOpen(true);
                          }}
                          title="Share / Embed Widget"
                        >
                          <Share2 size={12} />
                        </button>
                        <button 
                          className="user-delete-btn" 
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAgent(agent.id);
                          }}
                          title="Delete Agent"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Studio Builder & Live Testing Modal Popup */}
        {isStudioModalOpen && (
          <div
            className="ws-modal-backdrop"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(12px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px"
            }}
            onClick={() => setIsStudioModalOpen(false)}
          >
            <div
              className="ws-modal-card"
              style={{
                width: "100%",
                maxWidth: "1280px",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#121214",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                position: "relative"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "24px", width: "42px", height: "42px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {formData.avatar || "🤖"}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#ffffff" }}>
                      {isCreating ? "✨ Create New Custom Agent" : `⚙️ Configure ${formData.name || "Agent"}`}
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>
                      Customize prompt instructions, attach RAG knowledge base memory, and test live completions.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStudioModalOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#ffffff",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  title="Close Studio Configurator"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main 2-Column Studio Area */}
              <div className="studio-grid">
                {/* Left Column: Visual Configurator Form */}
                <div className="studio-card">
                  <div className="studio-card-header">
                    <h3>{isCreating ? "✨ Agent Configuration" : `⚙️ Configure ${selectedAgent?.name || "Agent"}`}</h3>
                    {selectedAgent?.id && !isCreating && (
                      <button 
                        className="admin-btn-secondary"
                        onClick={() => setShareModalOpen(true)}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                      >
                        <Share2 size={13} /> Share & Embed
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveAgent}>
                    {/* Avatar Selector */}
                    <div className="admin-input-group">
                      <label>Select Agent Avatar</label>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "6px 0 12px 0" }}>
                        {AVATAR_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setFormData({ ...formData, avatar: emoji })}
                            style={{
                              fontSize: "20px",
                              width: "40px",
                              height: "40px",
                              borderRadius: "8px",
                              border: formData.avatar === emoji ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.1)",
                              background: formData.avatar === emoji ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.03)",
                              cursor: "pointer"
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Agent Name & Category */}
                    <div className="admin-responsive-two-col">
                      <div className="admin-input-group">
                        <label>Agent Name *</label>
                        <input 
                          type="text" 
                          className="admin-input" 
                          placeholder="e.g. Legal Clause Auditor"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="admin-input-group">
                        <label>Category</label>
                        <select 
                          className="admin-select"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                          <option value="general">General AI</option>
                          <option value="support">Customer Support</option>
                          <option value="sales">Sales & Outreach</option>
                          <option value="engineering">Coding & DevOps</option>
                          <option value="legal">Legal & Compliance</option>
                          <option value="hr">HR & Recruiting</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="admin-input-group">
                      <label>Tagline / Description</label>
                      <input 
                        type="text" 
                        className="admin-input" 
                        placeholder="e.g. Specialized in reviewing SaaS contracts and NDAs"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    {/* Base Model */}
                    <div className="admin-input-group">
                      <label>Base LLM Engine</label>
                      <select 
                        className="admin-select"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      >
                        <option value="llama-3.3-70b-versatile">Groq Llama 3.3 70B (Ultra-Fast 140ms)</option>
                        <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Frontier Reasoning)</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B (High Context)</option>
                      </select>
                    </div>

                    {/* System Instructions / Persona Prompt */}
                    <div className="admin-input-group">
                      <label>System Instructions & Persona *</label>
                      <textarea 
                        className="admin-textarea"
                        rows={5}
                        placeholder="Define how the AI should behave, its tone, constraints, and instructions..."
                        value={formData.system_prompt}
                        onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                        required
                      />
                    </div>

                    {/* Attach RAG Knowledge Base */}
                    <div className="admin-input-group">
                      <label>Attach RAG Knowledge Base (Vector Memory)</label>
                      {kbs.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#a1a1aa" }}>No Knowledge Bases found. Upload docs in RAG Workspace to attach here.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                          {kbs.map(kb => (
                            <label key={kb._id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                              <input 
                                type="checkbox" 
                                checked={formData.attached_kb_ids.includes(kb._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({ ...formData, attached_kb_ids: [...formData.attached_kb_ids, kb._id] });
                                  } else {
                                    setFormData({ ...formData, attached_kb_ids: formData.attached_kb_ids.filter(id => id !== kb._id) });
                                  }
                                }}
                              />
                              <span>{kb.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit" 
                      className="admin-primary-btn" 
                      disabled={saving}
                      style={{ width: "100%", marginTop: "12px", padding: "12px" }}
                    >
                      {saving ? <Loader2 size={16} className="spin" /> : "Save & Publish Agent"}
                    </button>
                  </form>
                </div>

                {/* Right Column: Interactive Test Sandbox */}
                <div className="studio-card">
                  <div className="studio-card-header">
                    <h3>💬 Live Testing Sandbox</h3>
                    <button 
                      className="admin-refresh-btn"
                      style={{ padding: "4px 8px", fontSize: "11px" }}
                      onClick={() => setSandboxHistory([{ role: "assistant", content: `Hello! I am ${formData.name || "AI Assistant"}. Test me here!` }])}
                    >
                      <RefreshCw size={12} /> Reset Chat
                    </button>
                  </div>

                  <div className="sandbox-viewport">
                    {sandboxHistory.map((msg, idx) => (
                      <div key={idx} className={`sandbox-msg ${msg.role}`}>
                        {msg.role === "assistant" ? (
                          <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                        ) : (
                          msg.content
                        )}
                      </div>
                    ))}
                    {sandboxLoading && (
                      <div className="sandbox-msg assistant" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Loader2 size={14} className="spin" />
                        <span>Generating response...</span>
                      </div>
                    )}
                  </div>

                  {/* Sandbox input */}
                  <form onSubmit={handleSendSandboxMessage} className="sandbox-input-row">
                    <input 
                      type="text" 
                      className="admin-input" 
                      placeholder={`Chat with ${formData.name || "Custom Agent"}...`}
                      value={sandboxInput}
                      onChange={(e) => setSandboxInput(e.target.value)}
                    />
                    <button type="submit" className="admin-primary-btn" disabled={sandboxLoading || !sandboxInput.trim()}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share & Embed Modal */}
        {shareModalOpen && selectedAgent && (
          <div className="admin-modal-backdrop" onClick={() => setShareModalOpen(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
              <div className="studio-card-header">
                <h3>🚀 Share & Embed '{selectedAgent.name}'</h3>
                <button onClick={() => setShareModalOpen(false)} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", fontSize: "18px" }}>&times;</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Public Link */}
                <div className="admin-input-group">
                  <label>1-Click Shareable Chat URL</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input type="text" readOnly className="admin-input" value={publicShareUrl} />
                    <button 
                      className="admin-primary-btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(publicShareUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                    >
                      {copiedLink ? <Check size={14} /> : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Embed Widget Code */}
                <div className="admin-input-group">
                  <label>Website Embed Widget Script</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <textarea readOnly className="admin-textarea" rows={3} value={embedCodeSnippet} />
                  </div>
                  <button 
                    className="admin-primary-btn" 
                    style={{ marginTop: "8px", alignSelf: "flex-end" }}
                    onClick={() => {
                      navigator.clipboard.writeText(embedCodeSnippet);
                      setCopiedEmbed(true);
                      setTimeout(() => setCopiedEmbed(false), 2000);
                    }}
                  >
                    {copiedEmbed ? <Check size={14} /> : "Copy Embed Code"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AgentStudioPage;
