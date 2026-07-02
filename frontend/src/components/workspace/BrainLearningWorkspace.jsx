import { useEffect, useState } from "react";
import { Brain, Trash2, Search, Cpu, Check, X, ShieldAlert, Code, Sparkles, AlertCircle } from "lucide-react";
import api from "../../services/api";
import "../../styles/workspace.css";

export default function BrainLearningWorkspace() {
  const [learnings, setLearnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchLearnings();
  }, []);

  const fetchLearnings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ai/learnings");
      setLearnings(res.data || []);
    } catch (err) {
      console.error("Failed to load agent learnings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, currentEnabled) => {
    try {
      await api.put(`/ai/learnings/${id}/toggle`, null, {
        params: { enabled: !currentEnabled }
      });
      setLearnings((prev) =>
        prev.map((l) => (l._id === id ? { ...l, enabled: !currentEnabled } : l))
      );
    } catch (err) {
      console.error("Failed to toggle learning rule:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this learning rule?")) return;
    try {
      await api.delete(`/ai/learnings/${id}`);
      setLearnings((prev) => prev.filter((l) => l._id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete learning rule:", err);
    }
  };

  const filtered = learnings.filter((l) => {
    const term = searchQuery.toLowerCase();
    return (
      l.error_type?.toLowerCase().includes(term) ||
      l.error_message?.toLowerCase().includes(term) ||
      l.lesson_learned?.toLowerCase().includes(term) ||
      l.idea?.toLowerCase().includes(term)
    );
  });

  // Helper to extract Failed and Fixed blocks from diff text
  const parseDiffCode = (failedCodeText) => {
    if (!failedCodeText) return { failed: "", fixed: "" };
    
    const failedMatch = failedCodeText.match(/--- FAILED CODE ---\n([\s\S]*?)(?=\n--- FIXED CODE ---|$)/);
    const fixedMatch = failedCodeText.match(/--- FIXED CODE ---\n([\s\S]*?)$/);

    return {
      failed: failedMatch ? (failedMatch[1].trim ? failedMatch[1].trim() : failedMatch[1]) : "",
      fixed: fixedMatch ? (fixedMatch[1].trim ? fixedMatch[1].trim() : fixedMatch[1]) : ""
    };
  };

  // Helper to resolve badge coloring class based on error type
  const getBadgeClass = (errorType = "") => {
    const err = errorType.toLowerCase();
    if (err.includes("syntax")) return "badge-syntax";
    if (err.includes("import") || err.includes("module")) return "badge-import";
    if (err.includes("db") || err.includes("mongo") || err.includes("database")) return "badge-db";
    return "badge-logic";
  };

  return (
    <div className="brain-workspace-container" style={{ padding: "30px", overflowY: "auto", height: "calc(100vh - 80px)", color: "#e4e4e7" }}>
      {/* Dashboard Header */}
      <div className="brain-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", borderBottom: "1px solid #27272a", paddingBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#ffffff", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Cpu className="neon-glow-icon" style={{ color: "#8b5cf6", filter: "drop-shadow(0 0 8px #8b5cf6)" }} />
            Agent Self-Learning Core
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "14px", marginTop: "6px" }}>
            Review and manage lessons compile-analyzed from past code generation corrections.
          </p>
        </div>
        <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "12px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} style={{ color: "#a78bfa" }} />
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#e4e4e7" }}>
            Active Rules: {learnings.filter((l) => l.enabled).length} / {learnings.length}
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="search-bar-wrapper" style={{ position: "relative", marginBottom: "24px", maxWidth: "480px" }}>
        <Search style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#71717a" }} size={18} />
        <input
          type="text"
          placeholder="Search by error type, keyword, or lesson..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(20, 20, 20, 0.6)",
            border: "1px solid #27272a",
            borderRadius: "10px",
            padding: "12px 16px 12px 42px",
            color: "#ffffff",
            fontSize: "14px",
            outline: "none",
            transition: "border-color 0.2s"
          }}
          onFocus={(e) => (e.target.style.borderColor = "#8b5cf6")}
          onBlur={(e) => (e.target.style.borderColor = "#27272a")}
        />
      </div>

      {/* Content State Handler */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", color: "#a1a1aa" }}>
          <Cpu className="loading-spinner" size={40} style={{ marginBottom: "16px", color: "#8b5cf6" }} />
          <span>Analyzing agent memory registry...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "rgba(20, 20, 20, 0.4)", border: "1px solid #27272a", borderRadius: "16px", padding: "48px", textAlign: "center", color: "#71717a" }}>
          <AlertCircle size={48} style={{ margin: "0 auto 16px auto", color: "#3f3f46" }} />
          <h3 style={{ color: "#e4e4e7", fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>No Learning Rules Recorded</h3>
          <p style={{ maxWidth: "340px", margin: "0 auto", fontSize: "13px", lineHeight: "1.6" }}>
            Once the Engineer Agent runs through code verification loops and resolves compile errors, lessons will compile here.
          </p>
        </div>
      ) : (
        <div className="learnings-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filtered.map((l) => {
            const isExpanded = expandedId === l._id;
            const diff = parseDiffCode(l.failed_code);
            const badgeClass = getBadgeClass(l.error_type);

            return (
              <div
                key={l._id}
                className={`learning-card ${l.enabled ? "enabled" : "disabled"}`}
                style={{
                  background: "rgba(24, 24, 27, 0.55)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "14px",
                  padding: "20px",
                  transition: "all 0.2s"
                }}
              >
                {/* Card Top Section */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className={`error-badge ${badgeClass}`} style={{ fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {l.error_type || "LogicError"}
                    </span>
                    <span style={{ fontSize: "12px", color: "#71717a" }}>
                      {new Date(l.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions (Toggle & Delete) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={() => handleToggle(l._id, l.enabled)}
                      style={{
                        background: l.enabled ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                        border: "1px solid",
                        borderColor: l.enabled ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        color: l.enabled ? "#4ade80" : "#f87171",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 0.15s"
                      }}
                    >
                      {l.enabled ? <Check size={12} /> : <X size={12} />}
                      {l.enabled ? "Active" : "Disabled"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(l._id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#a1a1aa",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: "6px",
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Prompt Goal Idea */}
                {l.idea && (
                  <div style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "14px", fontStyle: "italic" }}>
                    &quot;{l.idea}&quot;
                  </div>
                )}

                {/* Dynamic Lesson Summary Box */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <Brain size={18} style={{ color: "#a1a1aa", marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block", fontSize: "12px", color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Lesson Learned</strong>
                    <p style={{ margin: 0, fontSize: "14px", color: "#e4e4e7", lineHeight: "1.5" }}>{l.lesson_learned}</p>
                  </div>
                </div>

                {/* Collapsible File Compare Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : l._id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: 0
                    }}
                  >
                    <Code size={14} />
                    {isExpanded ? "Hide Debug Code Diffs" : "View Debug Code Diffs"}
                  </button>

                  {/* Code Diff Display Container */}
                  {isExpanded && (
                    <div className="diff-panels-stacked" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                      {/* FAILED CODE PANEL */}
                      <div>
                        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.15)", borderBottom: "none", borderTopLeftRadius: "8px", borderTopRightRadius: "8px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <ShieldAlert size={14} style={{ color: "#f87171" }} />
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#f87171", textTransform: "uppercase" }}>Original Failed Code</span>
                        </div>
                        <pre style={{ margin: 0, background: "rgba(20, 20, 20, 0.5)", border: "1px solid rgba(239, 68, 68, 0.15)", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", padding: "12px", overflowX: "auto", fontSize: "12px", fontFamily: "monospace", color: "#fca5a5", maxHeight: "220px" }}>
                          <code>{diff.failed || l.error_message}</code>
                        </pre>
                      </div>

                      {/* FIXED CODE PANEL */}
                      <div>
                        <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.15)", borderBottom: "none", borderTopLeftRadius: "8px", borderTopRightRadius: "8px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Check size={14} style={{ color: "#4ade80" }} />
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#4ade80", textTransform: "uppercase" }}>Fixed Corrected Code</span>
                        </div>
                        <pre style={{ margin: 0, background: "rgba(20, 20, 20, 0.5)", border: "1px solid rgba(34, 197, 94, 0.15)", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", padding: "12px", overflowX: "auto", fontSize: "12px", fontFamily: "monospace", color: "#86efac", maxHeight: "220px" }}>
                          <code>{diff.fixed || "Successfully resolved"}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
