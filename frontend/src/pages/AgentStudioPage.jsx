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

function AgentStudioPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kbs, setKbs] = useState([]);
  
  // Selected / Active Agent
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

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

        {/* Existing Agents Carousel / Cards */}
        {agents.length > 0 && (
          <div className="agent-grid-list">
            {agents.map((agent) => (
              <div 
                key={agent.id} 
                className={`agent-item-card ${selectedAgent?.id === agent.id && !isCreating ? "active" : ""}`}
                onClick={() => {
                  setSelectedAgent(agent);
                  resetFormWithAgent(agent);
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

        {/* Main 2-Column Studio Area */}
        <div className="studio-grid">
          
          {/* Left Column: Visual Configurator Form */}
          <div className="studio-card">
            <div className="studio-card-header">
              <h3>{isCreating ? "✨ Create New Custom Agent" : `⚙️ Configure ${selectedAgent?.name || "Agent"}`}</h3>
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
