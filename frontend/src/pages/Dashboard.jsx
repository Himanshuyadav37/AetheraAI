import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Code2,
  Cpu,
  GraduationCap,
  Workflow,
  Database,
  Brain,
  ShieldCheck,
  CreditCard,
  Zap,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  ArrowUpRight,
  Copy,
  Check,
  Calendar,
  Users,
  Key,
  ChevronRight,
  Activity,
  HardDrive,
  BarChart3,
  PieChart,
  Bot,
  RefreshCw
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeRange, setActiveRange] = useState("7d"); // "24h" | "7d" | "30d"
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live state from backend analytics
  const [analytics, setAnalytics] = useState({
    user: {
      username: user?.username || user?.email?.split("@")[0] || "Himanshu",
      email: user?.email || "himanshu@aethera.ai",
      role: user?.role || "Enterprise Pro",
      join_date: user?.created_at ? new Date(user.created_at).toLocaleDateString() : "March 2024",
      plan: "Active Plan",
    },
    tokens: {
      total_quota: 500000,
      used: 0,
      remaining: 500000,
      percentage: 0,
    },
    credits: {
      total: 0,
      used: 0,
      remaining: 0,
      balance_usd: "$0.00",
      is_available: false,
      label: "Not available",
    },
    vector_store: {
      total_vectors: 0,
      namespaces_count: 0,
      namespaces: [],
      cloud: "ChromaDB / MongoDB",
      latency: "Local Persistent Engine",
      quota: "0 vectors stored",
    },
    memory: {
      total_rules: 0,
      personal_facts: 0,
      global_insights: 0,
    },
    charts: {
      agent_breakdown: [],
      weekly_usage: [],
      avg_tokens_day: 0,
      peak_day: "N/A",
      peak_tokens: 0,
      has_data: false,
    },
    activities: [],
    mesh: {
      mcp_tools_count: 0,
      latest_dossier_title: "No dossiers generated yet",
      webhook_url: "https://api.aethera.ai/v1/trigger/auth-mesh",
      webhook_status: "200 OK",
      team_devs_count: 1,
    }
  });

  const fetchRealAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get(`/users/dashboard-analytics?range=${activeRange}`);
      if (res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn("Analytics fetch fallback to cached state:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRealAnalytics();
  }, [activeRange]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchRealAnalytics();
    }, 15000); // 15s real-time heartbeat sync
    return () => clearInterval(timer);
  }, [activeRange]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText("nx_live_98a7bc81f20448109d9482f0c1");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const getAgentIcon = (name) => {
    if (name.includes("Engineer")) return Code2;
    if (name.includes("Research")) return Cpu;
    if (name.includes("Education")) return GraduationCap;
    return Workflow;
  };

  // Compute Donut SVG Dash Arrays dynamically
  const CIRCUMFERENCE = 251.327; // 2 * pi * 40
  let accumulatedPct = 0;
  const agentBreakdown = analytics?.charts?.agent_breakdown || [];
  const donutSegments = agentBreakdown.map((item, idx) => {
    const dashLength = ((item.percentage || 0) / 100) * CIRCUMFERENCE;
    const offset = -(accumulatedPct / 100) * CIRCUMFERENCE;
    accumulatedPct += item.percentage || 0;
    const colors = ["#ffffff", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b"];
    return {
      ...item,
      color: item.color || colors[idx % colors.length],
      dashArray: `${dashLength} ${CIRCUMFERENCE}`,
      dashOffset: offset,
      Icon: getAgentIcon(item.name || "")
    };
  });

  return (
    <DashboardLayout>
      <div className="user-dashboard-container">
        {/* =========================================================
            1. HERO USER PROFILE & TIER BANNER
            ========================================================= */}
        <section className="ud-profile-banner">
          <div className="ud-profile-left">
            <div className="ud-avatar-wrapper">
              <div className="ud-avatar">
                {analytics.user.username.charAt(0).toUpperCase()}
              </div>
              <span className="ud-avatar-status" title="Active Neural Session"></span>
            </div>

            <div className="ud-user-meta">
              <div className="ud-name-row">
                <h1 className="ud-username">{analytics.user.username}</h1>
                <span className="ud-tier-badge">
                  <ShieldCheck size={12} />
                  <span>{analytics.user.role}</span>
                </span>
                <span className="ud-plan-active-pill">{analytics.user.plan}</span>
              </div>
              <p className="ud-user-email">{analytics.user.email} • Member since {analytics.user.join_date}</p>
            </div>
          </div>

          <div className="ud-profile-actions">
            <button className="ud-btn-secondary" onClick={() => fetchRealAnalytics(true)} title="Sync Real-Time Metrics">
              <RefreshCw size={13} className={refreshing ? "spin-sync" : ""} />
              <span>{refreshing ? "Syncing..." : "Sync Real-Time"}</span>
            </button>

            <button className="ud-btn-secondary" onClick={handleCopyKey}>
              <Key size={14} />
              <span>{copiedKey ? "API Key Copied!" : "Copy Developer Key"}</span>
              {copiedKey ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            </button>

            <button className="ud-btn-primary" onClick={() => navigate("/workspace")}>
              <Zap size={14} />
              <span>Launch Workspace</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>

        {/* =========================================================
            2. TOP METRICS GRID (TOKENS, CREDITS, STORAGE, AGENTS)
            ========================================================= */}
        <section className="ud-metrics-grid">
          {/* Token Usage Card */}
          <div className="ud-metric-card">
            <div className="ud-metric-header">
              <span className="ud-metric-title">Token Quota Consumption</span>
              <div className="ud-metric-icon-box">
                <Zap size={15} />
              </div>
            </div>

            <div className="ud-metric-value-row">
              <span className="ud-metric-value">{analytics.tokens.used.toLocaleString()}</span>
              <span className="ud-metric-sub">/ {analytics.tokens.total_quota.toLocaleString()} tokens</span>
            </div>

            <div className="ud-progress-bar-bg">
              <div className="ud-progress-bar-fill" style={{ width: `${Math.min(100, analytics.tokens.percentage)}%` }}></div>
            </div>

            <div className="ud-metric-footer">
              <span>{analytics.tokens.percentage}% consumed</span>
              <span className="ud-highlight-white">{analytics.tokens.remaining.toLocaleString()} remaining</span>
            </div>
          </div>

          {/* Compute Credits Card */}
          <div className="ud-metric-card">
            <div className="ud-metric-header">
              <span className="ud-metric-title">Workspace Compute Credits</span>
              <div className="ud-metric-icon-box">
                <CreditCard size={15} />
              </div>
            </div>

            {analytics.credits?.is_available ? (
              <>
                <div className="ud-metric-value-row">
                  <span className="ud-metric-value">{(analytics.credits.remaining || 0).toLocaleString()}</span>
                  <span className="ud-metric-sub">/ {(analytics.credits.total || 0).toLocaleString()} Credits</span>
                </div>

                <div className="ud-progress-bar-bg">
                  <div className="ud-progress-bar-fill" style={{ width: `${analytics.credits.total ? ((analytics.credits.remaining || 0) / analytics.credits.total) * 100 : 0}%` }}></div>
                </div>

                <div className="ud-metric-footer">
                  <span>Usage-based compute</span>
                  <span className="ud-highlight-white">{analytics.credits.balance_usd || "$0.00"}</span>
                </div>
              </>
            ) : (
              <>
                <div className="ud-metric-value-row">
                  <span className="ud-metric-value" style={{ fontSize: "1.2rem", letterSpacing: "normal" }}>Not available</span>
                  <span className="ud-metric-sub">No compute execution</span>
                </div>

                <div className="ud-progress-bar-bg">
                  <div className="ud-progress-bar-fill" style={{ width: "0%" }}></div>
                </div>

                <div className="ud-metric-footer">
                  <span>Dedicated compute nodes</span>
                  <span className="ud-highlight-white" style={{ opacity: 0.6 }}>Inactive</span>
                </div>
              </>
            )}
          </div>

          {/* Vector Knowledge Base */}
          <div className="ud-metric-card">
            <div className="ud-metric-header">
              <span className="ud-metric-title">Vector Knowledge Base</span>
              <div className="ud-metric-icon-box">
                <Database size={15} />
              </div>
            </div>

            <div className="ud-metric-value-row">
              <span className="ud-metric-value">{(analytics.vector_store.total_vectors || 0).toLocaleString()}</span>
              <span className="ud-metric-sub">Vectors Indexed</span>
            </div>

            <div className="ud-stat-mini-grid">
              <div className="ud-stat-mini">
                <span className="stat-label">Engine:</span>
                <span className="stat-val">{analytics.vector_store.cloud}</span>
              </div>
              <div className="ud-stat-mini">
                <span className="stat-label">Collections:</span>
                <span className="stat-val">{analytics.vector_store.namespaces_count} Active</span>
              </div>
            </div>

            <div className="ud-metric-footer">
              <span className="ud-highlight-white">● Connected (Live)</span>
              <span>{analytics.vector_store.quota}</span>
            </div>
          </div>

          {/* Autonomous Memory Status */}
          <div className="ud-metric-card">
            <div className="ud-metric-header">
              <span className="ud-metric-title">Continuous Memory Engine</span>
              <div className="ud-metric-icon-box">
                <Brain size={15} />
              </div>
            </div>

            <div className="ud-metric-value-row">
              <span className="ud-metric-value">{analytics.memory.total_rules} Rules</span>
              <span className="ud-metric-sub">Auto-Learned</span>
            </div>

            <div className="ud-stat-mini-grid">
              <div className="ud-stat-mini">
                <span className="stat-label">Personal Facts:</span>
                <span className="stat-val">{analytics.memory.personal_facts} Preferences</span>
              </div>
              <div className="ud-stat-mini">
                <span className="stat-label">Global Insights:</span>
                <span className="stat-val">{analytics.memory.global_insights} Verified</span>
              </div>
            </div>

            <div className="ud-metric-footer">
              <span className="ud-highlight-white">● Auto-Distilling</span>
              <span>Zero Latency</span>
            </div>
          </div>
        </section>

        {/* =========================================================
            3. ANALYTICS & VISUAL CHARTS (DONUT + BAR GRAPH)
            ========================================================= */}
        <section className="ud-charts-section">
          {/* Left Chart: Weekly Consumption Bar Graph */}
          <div className="ud-chart-card">
            <div className="ud-chart-header">
              <div className="ud-chart-title-box">
                <BarChart3 size={18} className="ud-chart-icon" />
                <div>
                  <h3>Token Consumption Velocity</h3>
                  <p>Daily LLM & Vector computation over time</p>
                </div>
              </div>

              <div className="ud-range-selector">
                <button className={activeRange === "24h" ? "active" : ""} onClick={() => setActiveRange("24h")}>24H</button>
                <button className={activeRange === "7d" ? "active" : ""} onClick={() => setActiveRange("7d")}>7D</button>
                <button className={activeRange === "30d" ? "active" : ""} onClick={() => setActiveRange("30d")}>30D</button>
              </div>
            </div>

            {/* Custom SVG / HTML Bar Chart */}
            <div className="ud-bar-chart-container">
              {analytics.charts?.has_data && (analytics.charts?.weekly_usage || []).length > 0 ? (
                <div className="ud-bar-chart">
                  {analytics.charts.weekly_usage.map((item, idx) => (
                    <div key={item.day || idx} className="ud-bar-col">
                      <div className="ud-bar-tooltip">
                        {(item.tokens || 0).toLocaleString()} tokens
                      </div>
                      <div className="ud-bar-track">
                        <div
                          className={`ud-bar-fill ${item.day === analytics.charts.peak_day ? "peak-day" : ""}`}
                          style={{ height: `${item.height || 0}%` }}
                        ></div>
                      </div>
                      <span className="ud-bar-label">{item.day}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", color: "rgba(255,255,255,0.4)", gap: "8px" }}>
                  <Activity size={24} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: "0.85rem" }}>No usage recorded in this time range</span>
                </div>
              )}
            </div>

            {analytics.charts?.has_data ? (
              <div className="ud-chart-footnote">
                <TrendingUp size={14} className="text-success" />
                <span>Average {(analytics.charts.avg_tokens_day || 0).toLocaleString()} tokens/day • <strong>Peak activity on {analytics.charts.peak_day} ({(analytics.charts.peak_tokens || 0).toLocaleString()} tokens)</strong></span>
              </div>
            ) : (
              <div className="ud-chart-footnote">
                <Clock size={14} style={{ opacity: 0.4 }} />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Live consumption velocity updates automatically upon model generation</span>
              </div>
            )}
          </div>

          {/* Right Chart: Donut Breakdown by Agent */}
          <div className="ud-chart-card">
            <div className="ud-chart-header">
              <div className="ud-chart-title-box">
                <PieChart size={18} className="ud-chart-icon" />
                <div>
                  <h3>Agent Workload Breakdown</h3>
                  <p>Token allocation across autonomous engines</p>
                </div>
              </div>
            </div>

            {analytics.tokens?.used > 0 && donutSegments.length > 0 ? (
              <div className="ud-donut-layout">
                {/* Interactive Monochromatic SVG Donut Ring */}
                <div className="ud-donut-visual">
                  <svg viewBox="0 0 100 100" className="ud-donut-svg">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="12"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                      />
                    ))}
                  </svg>
                  <div className="ud-donut-center-text">
                    <span className="donut-num">{Math.round((analytics.tokens.used || 0) / 1000)}k</span>
                    <span className="donut-lbl">Tokens</span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="ud-donut-legend">
                  {donutSegments.map((item) => {
                    const Icon = item.Icon;
                    return (
                      <div
                        key={item.name}
                        className="ud-legend-row"
                        onClick={() => navigate(item.path)}
                        title={`Open ${item.name}`}
                      >
                        <div className="legend-left">
                          <span className="legend-color-dot" style={{ background: item.color }}></span>
                          <Icon size={14} style={{ color: item.color }} />
                          <span className="legend-name">{item.name}</span>
                        </div>
                        <div className="legend-right">
                          <span className="legend-tokens">{item.tokens}</span>
                          <span className="legend-pct">{item.percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(255,255,255,0.4)", gap: "8px" }}>
                <Bot size={28} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: "0.85rem" }}>No agent workload recorded yet</span>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================
            4. TIER-1 BENTO COMMAND MESH & INTEGRATED TOOLS
            ========================================================= */}
        <section className="ud-bento-section">
          <div className="ud-section-heading">
            <div>
              <h2>Active Developer Engines & Connected Mesh</h2>
              <p>Direct live command modules, sandboxes, and cloud infrastructure</p>
            </div>
            <div className="ud-bento-status-badge">
              <span className="bento-live-dot"></span>
              <span>All Systems Operational</span>
            </div>
          </div>

          <div className="ud-bento-grid">
            {/* 1. HERO BENTO CARD: Engineer AI Autonomous IDE (Spans 2 Columns) */}
            <div className="ud-bento-card bento-card-large" onClick={() => navigate("/workspace?agent=engineer")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Code2 size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Craft Autonomous IDE</h3>
                    <span className="bento-subtitle">Multi-Agent Code Synthesis & Real-time Live Sandbox</span>
                  </div>
                </div>
                <span className="bento-chip">
                  <span className="chip-dot-green"></span>
                  MicroVM Ready
                </span>
              </div>

              {/* Interactive Mini Terminal / Code Snippet Preview */}
              <div className="bento-code-preview">
                <div className="code-preview-top">
                  <div className="code-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span className="code-file-name">aethera_app/main.py • Python 3.11</span>
                  <span className="code-git-branch">git: main*</span>
                </div>
                <div className="code-preview-content">
                  <code>
                    <span className="syn-keyword">from</span> fastapi <span className="syn-keyword">import</span> FastAPI, Depends<br/>
                    <span className="syn-keyword">from</span> rag.vector_store <span className="syn-keyword">import</span> get_vector_store<br/>
                    <br/>
                    app = FastAPI(title=<span className="syn-string">"Aethera Microservices"</span>)<br/>
                    <span className="syn-comment"># Autonomous Code Verification: Zero compilation errors (Verified)</span>
                  </code>
                </div>
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn primary" onClick={(e) => { e.stopPropagation(); navigate("/workspace?agent=engineer"); }}>
                  <span>Open IDE Workspace</span>
                  <ArrowUpRight size={14} />
                </button>
                <button className="bento-action-btn secondary" onClick={(e) => { e.stopPropagation(); navigate("/generate"); }}>
                  <span>+ New Full-Stack Project</span>
                </button>
              </div>
            </div>

            {/* 2. BENTO CARD: Pinecone Cloud Vector Hub */}
            <div className="ud-bento-card" onClick={() => navigate("/workspace?tab=knowledge")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Database size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Pinecone Cloud Vector RAG</h3>
                    <span className="bento-subtitle">Serverless Neural Embeddings</span>
                  </div>
                </div>
                <span className="bento-chip">
                  <span className="chip-dot-green"></span>
                  Active Node
                </span>
              </div>

              <div className="bento-metric-banner">
                <div className="bento-mini-stat">
                  <span className="mini-num">{analytics.vector_store.total_vectors.toLocaleString()}</span>
                  <span className="mini-lbl">Total Vectors</span>
                </div>
                <div className="bento-mini-divider"></div>
                <div className="bento-mini-stat">
                  <span className="mini-num">{analytics.vector_store.latency}</span>
                  <span className="mini-lbl">Query Latency</span>
                </div>
                <div className="bento-mini-divider"></div>
                <div className="bento-mini-stat">
                  <span className="mini-num">{analytics.vector_store.namespaces_count}</span>
                  <span className="mini-lbl">Namespaces</span>
                </div>
              </div>

              <div className="bento-namespaces-preview">
                {analytics.vector_store.namespaces.map((ns, idx) => (
                  <span key={idx} className="ns-pill">{ns}</span>
                ))}
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn secondary full-width" onClick={(e) => { e.stopPropagation(); navigate("/workspace?tab=knowledge"); }}>
                  <span>Manage Vector Namespaces</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 3. BENTO CARD: Dynamic MCP Integrations Mesh */}
            <div className="ud-bento-card" onClick={() => navigate("/integrations")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Dynamic MCP Integrations</h3>
                    <span className="bento-subtitle">JSON-RPC Stdio & SSE Tools</span>
                  </div>
                </div>
                <span className="bento-chip">{analytics.mesh.mcp_tools_count} Tools</span>
              </div>

              {/* Connected Tools Status List */}
              <div className="bento-tools-status-list">
                <div className="tool-status-item">
                  <div className="tool-status-left">
                    <span className="tool-pulse-green"></span>
                    <span>PostgreSQL Database Pool</span>
                  </div>
                  <span className="tool-port">port 5432</span>
                </div>
                <div className="tool-status-item">
                  <div className="tool-status-left">
                    <span className="tool-pulse-green"></span>
                    <span>GitHub Organization PAT</span>
                  </div>
                  <span className="tool-port">read/write</span>
                </div>
                <div className="tool-status-item">
                  <div className="tool-status-left">
                    <span className="tool-pulse-green"></span>
                    <span>Docker Container Engine</span>
                  </div>
                  <span className="tool-port">socket: live</span>
                </div>
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn secondary full-width" onClick={(e) => { e.stopPropagation(); navigate("/integrations"); }}>
                  <span>Configure Integrations</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 4. BENTO CARD: Autonomous Research Engine */}
            <div className="ud-bento-card" onClick={() => navigate("/workspace?agent=research")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Research Intelligence</h3>
                    <span className="bento-subtitle">Deep Multi-Source Synthesis</span>
                  </div>
                </div>
                <span className="bento-chip">Live Crawlers</span>
              </div>

              <div className="bento-dossier-card">
                <span className="dossier-label">Latest Compiled Dossier</span>
                <p className="dossier-title">"{analytics.mesh.latest_dossier_title}"</p>
                <div className="dossier-footer">
                  <span>Markdown & Fact Sources</span>
                  <span className="dossier-verified">✓ Fact Verified</span>
                </div>
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn secondary full-width" onClick={(e) => { e.stopPropagation(); navigate("/workspace?agent=research"); }}>
                  <span>Start Research Query</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 5. BENTO CARD: Workflow Automation & Webhooks */}
            <div className="ud-bento-card" onClick={() => navigate("/workspace?agent=automation")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Workflow size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Workflow Automation</h3>
                    <span className="bento-subtitle">Event Triggers & n8n Hooks</span>
                  </div>
                </div>
                <span className="bento-chip">
                  <span className="chip-dot-green"></span>
                  {analytics.mesh.webhook_status}
                </span>
              </div>

              <div className="bento-webhook-box">
                <span className="webhook-label">Active Webhook Ingress</span>
                <div className="webhook-url-row">
                  <code>{analytics.mesh.webhook_url}</code>
                </div>
                <span className="webhook-meta">Active Ingress • 0ms drops</span>
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn secondary full-width" onClick={(e) => { e.stopPropagation(); navigate("/workspace?agent=automation"); }}>
                  <span>Open Automation Canvas</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* 6. BENTO CARD: Team Spaces & RBAC */}
            <div className="ud-bento-card" onClick={() => navigate("/teams")}>
              <div className="bento-card-glow"></div>
              
              <div className="bento-card-header">
                <div className="bento-title-group">
                  <div className="bento-icon-pill">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="bento-title">Team Organizations</h3>
                    <span className="bento-subtitle">Collaborative Knowledge & RBAC</span>
                  </div>
                </div>
                <span className="bento-chip">Pro Seats</span>
              </div>

              <div className="bento-team-preview">
                <div className="team-avatar-stack">
                  <span className="avatar-chip av-1">HY</span>
                  <span className="avatar-chip av-2">AK</span>
                  <span className="avatar-chip av-3">RD</span>
                  <span className="avatar-chip av-more">+{Math.max(1, analytics.mesh.team_devs_count - 3)}</span>
                </div>
                <div className="team-meta-info">
                  <span className="team-count-text">{analytics.mesh.team_devs_count} Active Developers</span>
                  <span className="team-role-pill">Enterprise Pool</span>
                </div>
              </div>

              <div className="bento-card-actions">
                <button className="bento-action-btn secondary full-width" onClick={(e) => { e.stopPropagation(); navigate("/teams"); }}>
                  <span>Manage Collaborators</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            5. RECENT ACTIVITY & AUDIT LOG TABLE
            ========================================================= */}
        <section className="ud-activity-section">
          <div className="ud-section-heading">
            <div>
              <h2>Recent Execution & Audit Logs</h2>
              <p>Live session trace history and token consumption records</p>
            </div>
            <button className="ud-view-all-btn" onClick={() => navigate("/executions")}>
              <span>View All Executions</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="ud-table-wrapper">
            <table className="ud-activity-table">
              <thead>
                <tr>
                  <th>Session / Task Name</th>
                  <th>Agent Engine</th>
                  <th>Model</th>
                  <th>Tokens Used</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.activities && analytics.activities.length > 0 ? (
                  analytics.activities.map((row) => (
                    <tr key={row.id}>
                      <td className="task-title-cell">
                        <div className="task-title-inner">
                          <Bot size={15} className="task-bot-icon" />
                          <span>{row.title}</span>
                        </div>
                      </td>
                      <td>
                        <span className="agent-badge">{row.agent}</span>
                      </td>
                      <td className="model-cell">{row.model}</td>
                      <td className="tokens-cell">{row.tokens}</td>
                      <td className="time-cell">{row.time}</td>
                      <td>
                        <span className={`status-pill status-pill-${(row.status || "completed").toLowerCase()}`}>
                          <Check size={11} />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem 1rem", color: "rgba(255,255,255,0.4)" }}>
                      <Activity size={24} style={{ margin: "0 auto 8px auto", opacity: 0.3, display: "block" }} />
                      <span>No recent activity recorded yet</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}