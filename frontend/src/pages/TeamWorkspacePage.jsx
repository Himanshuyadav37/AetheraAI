import React, { useState, useEffect, useRef } from "react";
import { 
  Users, UserPlus, Plus, Trash2, Mail, Shield, BookOpen, 
  Activity, Copy, Check, Sparkles, Building, Loader2, Settings, 
  AlertTriangle, Edit3, MessageSquare, Hash, Send, CheckCircle2, 
  Clock, Play, FileText, ArrowRight, BarChart2, DollarSign, 
  Cpu, ChevronRight, Eye, RefreshCw, Layers, Bot, Tag, LogOut
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./TeamWorkspace.css";

function TeamWorkspacePage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [activeTab, setActiveTab] = useState("channels"); // channels, kanban, docs, prompts, analytics, members, activity, settings
  const [loading, setLoading] = useState(true);

  // Edit Workspace State
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [updatingTeam, setUpdatingTeam] = useState(false);

  // Modals
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");

  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Tab 1: Channels & AI Co-Pilot State
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [createChannelModal, setCreateChannelModal] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanTopic, setNewChanTopic] = useState("");
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [aiActionResult, setAiActionResult] = useState(null);
  const chatScrollRef = useRef(null);

  // Tab 2: Kanban Task Board State
  const [tasks, setTasks] = useState([]);
  const [createTaskModal, setCreateTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskTags, setTaskTags] = useState("Backend, API");
  const [aiSprintModal, setAiSprintModal] = useState(false);
  const [sprintGoal, setSprintGoal] = useState("");
  const [aiSprintLoading, setAiSprintLoading] = useState(false);

  // Tab 3: Team Docs & Wiki State
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docCategory, setDocCategory] = useState("Architecture");
  const [docMode, setDocMode] = useState("edit"); // edit, preview
  const [savingDoc, setSavingDoc] = useState(false);
  const [aiDocLoading, setAiDocLoading] = useState(false);

  // Tab 4: Prompt Vault & Runner State
  const [prompts, setPrompts] = useState([]);
  const [createPromptModal, setCreatePromptModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptCategory, setPromptCategory] = useState("Engineering");
  const [copiedPromptId, setCopiedPromptId] = useState(null);
  const [runPromptModal, setRunPromptModal] = useState(false);
  const [promptToRun, setPromptToRun] = useState(null);
  const [promptRunOutput, setPromptRunOutput] = useState("");
  const [runningPrompt, setRunningPrompt] = useState(false);

  // Tab 5: Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Tab 6 & 7: Members & Activities
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    loadTeams();

    const handleTeamsUpdated = () => {
      loadTeams();
    };
    window.addEventListener("my_teams_updated", handleTeamsUpdated);
    return () => window.removeEventListener("my_teams_updated", handleTeamsUpdated);
  }, []);

  useEffect(() => {
    if (selectedTeam?.id) {
      setEditName(selectedTeam.name || "");
      setEditDesc(selectedTeam.description || "");

      if (activeTab === "channels") loadChannels(selectedTeam.id);
      if (activeTab === "kanban") loadTasks(selectedTeam.id);
      if (activeTab === "docs") loadDocs(selectedTeam.id);
      if (activeTab === "prompts") loadPrompts(selectedTeam.id);
      if (activeTab === "analytics") loadAnalytics(selectedTeam.id);
      if (activeTab === "activity") loadActivities(selectedTeam.id);
    }
  }, [selectedTeam, activeTab]);

  useEffect(() => {
    if (selectedTeam?.id && activeChannel?.id) {
      loadMessages(selectedTeam.id, activeChannel.id);
    }
  }, [selectedTeam, activeChannel]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Data loaders
  async function loadTeams() {
    setLoading(true);
    try {
      const res = await api.get("/api/teams/my");
      const fetched = res.data || [];
      setTeams(fetched);
      if (fetched.length > 0 && !selectedTeam) {
        setSelectedTeam(fetched[0]);
      }
    } catch (err) {
      console.error("Failed to load teams", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannels(teamId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/channels`);
      const chans = res.data || [];
      setChannels(chans);
      if (chans.length > 0 && (!activeChannel || !chans.some(c => c.id === activeChannel.id))) {
        setActiveChannel(chans[0]);
      }
    } catch (e) {
      console.warn("Could not load channels", e);
    }
  }

  async function loadMessages(teamId, channelId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/channels/${channelId}/messages`);
      setMessages(res.data || []);
    } catch (e) {
      console.warn("Could not load messages", e);
    }
  }

  async function loadTasks(teamId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/tasks`);
      setTasks(res.data || []);
    } catch (e) {
      console.warn("Could not load tasks", e);
    }
  }

  async function loadDocs(teamId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/docs`);
      const fetchedDocs = res.data || [];
      setDocs(fetchedDocs);
      if (fetchedDocs.length > 0 && !selectedDoc) {
        handleSelectDoc(fetchedDocs[0]);
      } else if (fetchedDocs.length === 0) {
        handleNewDocInit();
      }
    } catch (e) {
      console.warn("Could not load docs", e);
    }
  }

  async function loadPrompts(teamId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/prompts`);
      setPrompts(res.data || []);
    } catch (e) {
      console.warn("Could not load team prompts", e);
    }
  }

  async function loadAnalytics(teamId) {
    setAnalyticsLoading(true);
    try {
      const res = await api.get(`/api/teams/${teamId}/analytics`);
      setAnalyticsData(res.data);
    } catch (e) {
      console.warn("Could not load analytics", e);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadActivities(teamId) {
    try {
      const res = await api.get(`/api/teams/${teamId}/activity`);
      setActivities(res.data || []);
    } catch (e) {
      console.warn("Could not load team activities", e);
    }
  }

  // Channel Operations
  async function handleCreateChannel(e) {
    e.preventDefault();
    if (!newChanName.trim() || !selectedTeam?.id) return;
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/channels`, {
        name: newChanName,
        topic: newChanTopic
      });
      setChannels([...channels, res.data]);
      setActiveChannel(res.data);
      setNewChanName("");
      setNewChanTopic("");
      setCreateChannelModal(false);
    } catch (err) {
      alert("Error creating channel: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeam?.id || !activeChannel?.id) return;
    const msgToSend = newMessage;
    setNewMessage("");
    setSendingMsg(true);
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/channels/${activeChannel.id}/messages`, {
        content: msgToSend
      });
      const newMsgList = [...messages, res.data.user_message];
      if (res.data.ai_reply) {
        newMsgList.push(res.data.ai_reply);
      }
      setMessages(newMsgList);
    } catch (err) {
      alert("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleExecuteAiAction(action) {
    if (!selectedTeam?.id || !activeChannel?.id) return;
    setAiActionLoading(true);
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/channels/${activeChannel.id}/ai-action?action=${action}`);
      setAiActionResult(res.data.result);
    } catch (err) {
      alert("Failed to execute AI action");
    } finally {
      setAiActionLoading(false);
    }
  }

  // Kanban Operations
  async function handleCreateTask(e) {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedTeam?.id) return;
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/tasks`, {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        assignee_email: taskAssignee || user?.email,
        tags: taskTags.split(",").map(t => t.trim()).filter(Boolean)
      });
      setTasks([res.data, ...tasks]);
      setTaskTitle("");
      setTaskDesc("");
      setCreateTaskModal(false);
    } catch (err) {
      alert("Error creating task: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleUpdateTaskStatus(taskId, newStatus) {
    try {
      const res = await api.put(`/api/teams/${selectedTeam.id}/tasks/${taskId}`, {
        status: newStatus
      });
      setTasks(tasks.map(t => t.id === taskId ? res.data : t));
    } catch (err) {
      alert("Error updating task status");
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      await api.delete(`/api/teams/${selectedTeam.id}/tasks/${taskId}`);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      alert("Error deleting task");
    }
  }

  async function handleAiSprintBreakdown(e) {
    e.preventDefault();
    if (!sprintGoal.trim() || !selectedTeam?.id) return;
    setAiSprintLoading(true);
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/tasks/ai-sprint-breakdown`, {
        goal: sprintGoal
      });
      setTasks([...(res.data || []), ...tasks]);
      setSprintGoal("");
      setAiSprintModal(false);
      alert(`AI created ${res.data?.length || 0} sprint task cards!`);
    } catch (err) {
      alert("Error generating sprint tasks: " + (err.response?.data?.detail || err.message));
    } finally {
      setAiSprintLoading(false);
    }
  }

  // Docs Operations
  function handleSelectDoc(doc) {
    setSelectedDoc(doc);
    setDocTitle(doc.title || "");
    setDocContent(doc.content || "");
    setDocCategory(doc.category || "Architecture");
    setDocMode("edit");
  }

  function handleNewDocInit() {
    setSelectedDoc(null);
    setDocTitle("New Technical Specification");
    setDocContent("# Technical Specification & Architecture\n\n## Overview\nDescribe the system scope...\n\n## Architecture & Endpoints\n- `POST /api/v1/...`\n\n## Implementation Checklist\n- [ ] Database Schema\n- [ ] API Endpoints\n- [ ] Unit Tests");
    setDocCategory("Architecture");
    setDocMode("edit");
  }

  async function handleSaveDoc() {
    if (!docTitle.trim() || !selectedTeam?.id) return;
    setSavingDoc(true);
    try {
      if (selectedDoc?.id) {
        const res = await api.put(`/api/teams/${selectedTeam.id}/docs/${selectedDoc.id}`, {
          title: docTitle,
          content: docContent,
          category: docCategory
        });
        setDocs(docs.map(d => d.id === selectedDoc.id ? res.data : d));
        setSelectedDoc(res.data);
      } else {
        const res = await api.post(`/api/teams/${selectedTeam.id}/docs`, {
          title: docTitle,
          content: docContent,
          category: docCategory
        });
        setDocs([res.data, ...docs]);
        setSelectedDoc(res.data);
      }
      alert("Document saved successfully!");
    } catch (err) {
      alert("Error saving document: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleDeleteDoc(docId) {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/api/teams/${selectedTeam.id}/docs/${docId}`);
      const updated = docs.filter(d => d.id !== docId);
      setDocs(updated);
      if (selectedDoc?.id === docId) {
        if (updated.length > 0) handleSelectDoc(updated[0]);
        else handleNewDocInit();
      }
    } catch (err) {
      alert("Error deleting document");
    }
  }

  async function handleAiEnhanceDoc() {
    if (!docTitle.trim() || !selectedTeam?.id) return;
    setAiDocLoading(true);
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/docs/ai-enhance`, {
        title: docTitle,
        content: docContent,
        instruction: "Structure this technical specification with comprehensive architecture, security considerations, API schema, and testing checklist."
      });
      setDocContent(res.data.enhanced_content);
      alert("Doc enhanced by AI!");
    } catch (err) {
      alert("AI enhancement failed");
    } finally {
      setAiDocLoading(false);
    }
  }

  // Prompt Vault & Runner Operations
  async function handleCreatePrompt(e) {
    e.preventDefault();
    if (!promptTitle.trim() || !promptText.trim() || !selectedTeam?.id) return;
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/prompts`, {
        title: promptTitle,
        prompt_text: promptText,
        category: promptCategory
      });
      setPrompts([res.data, ...prompts]);
      setPromptTitle("");
      setPromptText("");
      setCreatePromptModal(false);
    } catch (err) {
      alert("Error saving prompt: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleDeletePrompt(promptId) {
    try {
      await api.delete(`/api/teams/${selectedTeam.id}/prompts/${promptId}`);
      setPrompts(prompts.filter(p => p.id !== promptId));
    } catch (err) {
      alert("Error deleting prompt");
    }
  }

  async function handleRunPromptExecute() {
    if (!promptToRun || !selectedTeam?.id) return;
    setRunningPrompt(true);
    setPromptRunOutput("");
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/prompts/${promptToRun.id}/run`, {});
      setPromptRunOutput(res.data.output);
    } catch (err) {
      setPromptRunOutput("Error executing prompt");
    } finally {
      setRunningPrompt(false);
    }
  }

  // Workspace Settings
  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const res = await api.post("/api/teams", {
        name: newTeamName,
        description: newTeamDesc
      });
      setTeams([res.data, ...teams]);
      setSelectedTeam(res.data);
      setNewTeamName("");
      setNewTeamDesc("");
      setCreateTeamModal(false);
    } catch (err) {
      alert("Error creating team: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleUpdateTeam(e) {
    e.preventDefault();
    if (!editName.trim() || !selectedTeam?.id) return;
    setUpdatingTeam(true);
    try {
      const res = await api.put(`/api/teams/${selectedTeam.id}`, {
        name: editName.trim(),
        description: editDesc.trim()
      });
      setSelectedTeam(res.data);
      setTeams(teams.map(t => t.id === selectedTeam.id ? res.data : t));
      alert("Workspace settings updated successfully!");
    } catch (err) {
      alert("Error updating workspace: " + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingTeam(false);
    }
  }

  async function handleDeleteTeam(teamId, teamName) {
    if (!window.confirm(`Are you sure you want to permanently delete workspace "${teamName}"? All shared channels, tasks, docs, and member links will be removed.`)) return;
    try {
      await api.delete(`/api/teams/${teamId}`);
      const updated = teams.filter(t => t.id !== teamId);
      setTeams(updated);
      if (updated.length > 0) {
        setSelectedTeam(updated[0]);
      } else {
        setSelectedTeam(null);
      }
      alert(`Team workspace "${teamName}" deleted successfully.`);
      window.dispatchEvent(new CustomEvent("my_teams_updated"));
    } catch (err) {
      alert("Error deleting workspace: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleLeaveTeam(teamId, teamName) {
    if (!window.confirm(`Are you sure you want to leave workspace "${teamName}"? You will lose access to all channels, tasks, and documentation.`)) return;
    try {
      await api.post(`/api/teams/${teamId}/leave`);
      const updated = teams.filter(t => t.id !== teamId);
      setTeams(updated);
      if (updated.length > 0) {
        setSelectedTeam(updated[0]);
      } else {
        setSelectedTeam(null);
      }
      alert(`You have successfully left workspace "${teamName}".`);
      window.dispatchEvent(new CustomEvent("my_teams_updated"));
    } catch (err) {
      alert("Error leaving workspace: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedTeam?.id) return;
    try {
      const res = await api.post(`/api/teams/${selectedTeam.id}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      if (res.data?.team) {
        setSelectedTeam(res.data.team);
        setTeams(teams.map(t => t.id === selectedTeam.id ? res.data.team : t));
      }
      setInviteEmail("");
      setInviteModal(false);
      alert(res.data?.message || `Invitation sent to ${inviteEmail}! They will see a notification popup to accept or decline.`);
    } catch (err) {
      alert("Error inviting member: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleRemoveMember(memberEmail) {
    if (!window.confirm(`Remove ${memberEmail} from this team?`)) return;
    try {
      await api.delete(`/api/teams/${selectedTeam.id}/members/${memberEmail}`);
      const updatedMembers = selectedTeam.members.filter(m => m.email !== memberEmail);
      const updated = { ...selectedTeam, members: updatedMembers };
      setSelectedTeam(updated);
      setTeams(teams.map(t => t.id === selectedTeam.id ? updated : t));
    } catch (err) {
      alert("Error removing member: " + (err.response?.data?.detail || err.message));
    }
  }

  return (
    <DashboardLayout>
      <div className="team-page">
        {/* Header */}
        <div className="team-header">
          <div className="team-header-title">
            <Users className="team-shield-icon" />
            <div>
              <h1>Multi-Tenant Team Workspaces</h1>
              <p>Collaborative enterprise hub with live AI channels, sprint Kanban, shared tech wiki & quota telemetry.</p>
            </div>
          </div>
          <button 
            type="button" 
            className="admin-primary-btn" 
            onClick={() => setCreateTeamModal(true)}
          >
            <Plus size={16} /> Create Team Space
          </button>
        </div>

        {/* Empty State when no teams exist */}
        {!loading && teams.length === 0 && (
          <div className="admin-card" style={{ textAlign: "center", padding: "60px 20px", marginTop: "20px" }}>
            <Building size={48} style={{ color: "#71717a", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#ffffff", marginBottom: "8px" }}>No Active Workspaces Found</h3>
            <p style={{ color: "#a1a1aa", fontSize: "14px", maxWidth: "480px", margin: "0 auto 24px" }}>
              Create an organization workspace to start real-time AI channels, sprint boards, technical documentation, and role-based collaboration.
            </p>
            <button 
              type="button" 
              className="admin-primary-btn" 
              onClick={() => setCreateTeamModal(true)}
              style={{ margin: "0 auto" }}
            >
              <Plus size={16} /> Create Your First Workspace
            </button>
          </div>
        )}

        {/* Team Switcher Bar */}
        {teams.length > 0 && selectedTeam && (
          <div className="team-switcher-toolbar">
            <Building size={16} style={{ color: "#a1a1aa" }} />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>Active Workspace:</span>
            <select
              className="admin-select"
              style={{ width: "240px", padding: "6px 12px" }}
              value={selectedTeam?.id || ""}
              onChange={(e) => {
                const found = teams.find(t => t.id === e.target.value);
                if (found) setSelectedTeam(found);
              }}
            >
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.members?.length || 1} members)</option>
              ))}
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              <button 
                className="admin-primary-btn" 
                style={{ fontSize: "12px", padding: "6px 14px" }}
                onClick={() => setInviteModal(true)}
              >
                <UserPlus size={14} /> Invite Member
              </button>
              <button 
                className="user-delete-btn" 
                style={{ fontSize: "12px", padding: "6px 12px" }}
                onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                title="Delete active workspace"
              >
                <Trash2 size={13} /> Delete Workspace
              </button>
            </div>
          </div>
        )}

        {/* Enterprise Navigation Tabs */}
        {teams.length > 0 && selectedTeam && (
          <div>
            <div className="team-tabs-nav">
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "channels" ? "active" : ""}`}
                onClick={() => setActiveTab("channels")}
              >
                <MessageSquare size={14} /> AI Channels & Co-Pilot
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "kanban" ? "active" : ""}`}
                onClick={() => setActiveTab("kanban")}
              >
                <Layers size={14} /> AI Sprint Kanban
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "docs" ? "active" : ""}`}
                onClick={() => setActiveTab("docs")}
              >
                <FileText size={14} /> Tech Specs & Docs Wiki
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "prompts" ? "active" : ""}`}
                onClick={() => setActiveTab("prompts")}
              >
                <BookOpen size={14} /> Shared Prompts & Runner
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
                onClick={() => setActiveTab("analytics")}
              >
                <BarChart2 size={14} /> Quotas & Token Telemetry
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "members" ? "active" : ""}`}
                onClick={() => setActiveTab("members")}
              >
                <Users size={14} /> Team Members ({selectedTeam.members?.length || 1})
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "activity" ? "active" : ""}`}
                onClick={() => setActiveTab("activity")}
              >
                <Activity size={14} /> Activity Feed
              </button>
              <button 
                type="button" 
                className={`team-tab-btn ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <Settings size={14} /> Settings & Danger Zone
              </button>
            </div>

            {/* TAB 1: Real-Time Channels & AI Co-Pilot */}
            {activeTab === "channels" && (
              <div>
                <div className="channel-container">
                  {/* Left Channels List */}
                  <div className="channel-sidebar">
                    <div className="channel-sidebar-header">
                      <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "#a1a1aa" }}>Channels</span>
                      <button 
                        type="button" 
                        className="admin-btn-secondary" 
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={() => setCreateChannelModal(true)}
                        title="Add Channel"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="channel-list">
                      {channels.map(c => (
                        <div 
                          key={c.id} 
                          className={`channel-item ${activeChannel?.id === c.id ? "active" : ""}`}
                          onClick={() => setActiveChannel(c)}
                        >
                          <Hash size={14} style={{ color: "#71717a" }} />
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
                      <div style={{ fontSize: "11px", color: "#71717a", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Bot size={13} style={{ color: "#ffffff" }} /> Tip: Mention <b>@nexus</b> in any channel for AI assistance.
                      </div>
                    </div>
                  </div>

                  {/* Right Chat Main */}
                  <div className="channel-chat-main">
                    {/* Header */}
                    <div className="channel-chat-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Hash size={18} style={{ color: "#ffffff" }} />
                        <div>
                          <span style={{ fontWeight: "700", fontSize: "14px", color: "#ffffff" }}>{activeChannel?.name || "general"}</span>
                          <span style={{ fontSize: "12px", color: "#a1a1aa", marginLeft: "10px" }}>{activeChannel?.topic || "Live discussion"}</span>
                        </div>
                      </div>

                      {/* Quick AI Action Tools */}
                      <div className="channel-quick-actions">
                        <button 
                          className="channel-action-btn"
                          onClick={() => handleExecuteAiAction("summarize")}
                          disabled={aiActionLoading}
                        >
                          <Sparkles size={12} /> Summarize
                        </button>
                        <button 
                          className="channel-action-btn"
                          onClick={() => handleExecuteAiAction("action_items")}
                          disabled={aiActionLoading}
                        >
                          <CheckCircle2 size={12} /> Extract Tasks
                        </button>
                        <button 
                          className="channel-action-btn"
                          onClick={() => handleExecuteAiAction("tech_spec")}
                          disabled={aiActionLoading}
                        >
                          <FileText size={12} /> Tech Spec
                        </button>
                      </div>
                    </div>

                    {/* AI Action Result Banner */}
                    {aiActionResult && (
                      <div style={{ background: "var(--team-card-inner-bg, rgba(255,255,255,0.06))", borderBottom: "1px solid var(--team-border)", padding: "14px 18px", position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--team-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Sparkles size={13} /> AI Channel Synthesis
                          </span>
                          <button 
                            className="admin-btn-secondary" 
                            style={{ padding: "2px 6px", fontSize: "10px" }}
                            onClick={() => setAiActionResult(null)}
                          >
                            Close
                          </button>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--team-text)", lineHeight: "1.5", maxHeight: "140px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                          {aiActionResult}
                        </div>
                      </div>
                    )}

                    {/* Messages Scroll Area */}
                    <div className="channel-messages-scroll" ref={chatScrollRef}>
                      {messages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#71717a", margin: "auto", fontSize: "13px" }}>
                          No messages in #{activeChannel?.name || "general"} yet. Start the conversation or ask @nexus for help!
                        </div>
                      ) : (
                        messages.map((m, idx) => (
                          <div key={idx} className={`message-bubble ${m.is_ai ? "is-ai" : ""}`}>
                            <div className={`message-avatar ${m.is_ai ? "ai-avatar" : ""}`}>
                              {m.is_ai ? "🤖" : (m.sender_name?.charAt(0).toUpperCase() || "U")}
                            </div>
                            <div className="message-content-wrapper">
                              <div className="message-meta">
                                <span className="message-author">{m.sender_name}</span>
                                {m.is_ai && <span className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>AI CO-PILOT</span>}
                                <span className="message-time">{m.timestamp?.replace("T", " ").substring(11, 16)}</span>
                              </div>
                              <div className="message-text">{m.content}</div>
                            </div>
                          </div>
                        ))
                      )}
                      {sendingMsg && (
                        <div className="message-bubble is-ai">
                          <div className="message-avatar ai-avatar">🤖</div>
                          <div className="message-content-wrapper">
                            <span style={{ fontSize: "12px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "6px" }}>
                              <Loader2 className="btn-spinner" size={13} /> NexusAI Co-Pilot thinking...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input Bar */}
                    <form className="channel-input-bar" onSubmit={handleSendMessage}>
                      <button 
                        type="button" 
                        className="admin-btn-secondary" 
                        style={{ padding: "8px 12px", fontSize: "12px" }}
                        onClick={() => setNewMessage(prev => prev ? `${prev} @nexus ` : "@nexus ")}
                        title="Mention AI"
                      >
                        <Bot size={14} /> @nexus
                      </button>
                      <input 
                        type="text" 
                        className="admin-input" 
                        placeholder={`Message #${activeChannel?.name || "general"}... (Type @nexus for AI help)`}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="admin-primary-btn" disabled={!newMessage.trim() || sendingMsg}>
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Collaborative AI Kanban Task Board */}
            {activeTab === "kanban" && (
              <div>
                <div className="kanban-topbar">
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "var(--team-text)" }}>Sprint & Task Management</h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--team-text-muted)" }}>Collaborative engineering board with 1-click AI goal breakdown.</p>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button 
                      className="admin-primary-btn"
                      onClick={() => setAiSprintModal(true)}
                    >
                      <Sparkles size={14} /> ✨ AI Sprint Planner
                    </button>
                    <button 
                      className="admin-btn-secondary"
                      onClick={() => setCreateTaskModal(true)}
                    >
                      <Plus size={14} /> Add Task
                    </button>
                  </div>
                </div>

                <div className="kanban-grid">
                  {/* Column 1: Backlog / To Do */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <span className="kanban-column-title">
                        <Clock size={14} style={{ color: "#a1a1aa" }} /> To Do / Backlog
                      </span>
                      <span className="kanban-count-badge">
                        {tasks.filter(t => t.status === "todo").length}
                      </span>
                    </div>
                    <div className="kanban-cards-list">
                      {tasks.filter(t => t.status === "todo").map(t => (
                        <div key={t.id} className="kanban-card">
                          <span className="kanban-card-title">{t.title}</span>
                          {t.description && <span className="kanban-card-desc">{t.description}</span>}
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                            {t.tags?.map((tag, i) => (
                              <span key={i} className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>{tag}</span>
                            ))}
                          </div>
                          <div className="kanban-card-meta">
                            <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button 
                                className="admin-btn-secondary" 
                                style={{ padding: "3px 8px", fontSize: "10px" }}
                                onClick={() => handleUpdateTaskStatus(t.id, "in_progress")}
                                title="Move to In Progress"
                              >
                                Start ➔
                              </button>
                              <button 
                                className="user-delete-btn" 
                                style={{ padding: "3px 6px", fontSize: "10px" }}
                                onClick={() => handleDeleteTask(t.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: In Progress */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <span className="kanban-column-title">
                        <Sparkles size={14} style={{ color: "#60a5fa" }} /> In Progress
                      </span>
                      <span className="kanban-count-badge">
                        {tasks.filter(t => t.status === "in_progress").length}
                      </span>
                    </div>
                    <div className="kanban-cards-list">
                      {tasks.filter(t => t.status === "in_progress").map(t => (
                        <div key={t.id} className="kanban-card">
                          <span className="kanban-card-title">{t.title}</span>
                          {t.description && <span className="kanban-card-desc">{t.description}</span>}
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                            {t.tags?.map((tag, i) => (
                              <span key={i} className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>{tag}</span>
                            ))}
                          </div>
                          <div className="kanban-card-meta">
                            <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button 
                                className="admin-btn-secondary" 
                                style={{ padding: "3px 8px", fontSize: "10px" }}
                                onClick={() => handleUpdateTaskStatus(t.id, "review")}
                              >
                                Review ➔
                              </button>
                              <button 
                                className="user-delete-btn" 
                                style={{ padding: "3px 6px", fontSize: "10px" }}
                                onClick={() => handleDeleteTask(t.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Under Review / AI Audit */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <span className="kanban-column-title">
                        <Shield size={14} style={{ color: "#fb923c" }} /> Review & AI Audit
                      </span>
                      <span className="kanban-count-badge">
                        {tasks.filter(t => t.status === "review").length}
                      </span>
                    </div>
                    <div className="kanban-cards-list">
                      {tasks.filter(t => t.status === "review").map(t => (
                        <div key={t.id} className="kanban-card">
                          <span className="kanban-card-title">{t.title}</span>
                          {t.description && <span className="kanban-card-desc">{t.description}</span>}
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                            {t.tags?.map((tag, i) => (
                              <span key={i} className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>{tag}</span>
                            ))}
                          </div>
                          <div className="kanban-card-meta">
                            <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button 
                                className="admin-primary-btn" 
                                style={{ padding: "3px 8px", fontSize: "10px" }}
                                onClick={() => handleUpdateTaskStatus(t.id, "done")}
                              >
                                Complete ✓
                              </button>
                              <button 
                                className="user-delete-btn" 
                                style={{ padding: "3px 6px", fontSize: "10px" }}
                                onClick={() => handleDeleteTask(t.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 4: Completed */}
                  <div className="kanban-column">
                    <div className="kanban-column-header">
                      <span className="kanban-column-title">
                        <CheckCircle2 size={14} style={{ color: "#4ade80" }} /> Done
                      </span>
                      <span className="kanban-count-badge">
                        {tasks.filter(t => t.status === "done").length}
                      </span>
                    </div>
                    <div className="kanban-cards-list">
                      {tasks.filter(t => t.status === "done").map(t => (
                        <div key={t.id} className="kanban-card" style={{ opacity: 0.8 }}>
                          <span className="kanban-card-title" style={{ textDecoration: "line-through", color: "#a1a1aa" }}>{t.title}</span>
                          <div className="kanban-card-meta">
                            <span className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>COMPLETED</span>
                            <button 
                              className="user-delete-btn" 
                              style={{ padding: "3px 6px", fontSize: "10px" }}
                              onClick={() => handleDeleteTask(t.id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Tech Specs & Docs Wiki */}
            {activeTab === "docs" && (
              <div>
                <div className="docs-container">
                  {/* Left Docs List */}
                  <div className="docs-sidebar">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--team-text)" }}>Knowledge Wiki</span>
                      <button 
                        className="admin-primary-btn" 
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                        onClick={handleNewDocInit}
                      >
                        <Plus size={12} /> New Doc
                      </button>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {docs.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#71717a", fontSize: "12px", marginTop: "20px" }}>
                          No team docs yet. Create one!
                        </div>
                      ) : (
                        docs.map(d => (
                          <div 
                            key={d.id} 
                            className={`docs-item ${selectedDoc?.id === d.id ? "active" : ""}`}
                            onClick={() => handleSelectDoc(d)}
                          >
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>{d.title}</span>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className="user-stats-badges badge-cyan" style={{ fontSize: "9px" }}>{d.category}</span>
                              <span style={{ fontSize: "10px", color: "#71717a" }}>{d.updated_at?.substring(0, 10)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Editor / Preview */}
                  <div className="docs-editor-pane">
                    <div className="docs-editor-header">
                      <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: 1 }}>
                        <input 
                          type="text" 
                          className="admin-input" 
                          value={docTitle} 
                          onChange={(e) => setDocTitle(e.target.value)} 
                          placeholder="Document Title..."
                          style={{ fontWeight: "600", fontSize: "14px", width: "60%" }}
                        />
                        <select 
                          className="admin-select" 
                          value={docCategory} 
                          onChange={(e) => setDocCategory(e.target.value)}
                          style={{ width: "140px", padding: "6px" }}
                        >
                          <option value="Architecture">Architecture</option>
                          <option value="ProductSpec">Product Spec</option>
                          <option value="Security">Security SOP</option>
                          <option value="DevOps">DevOps & CI/CD</option>
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          className="channel-action-btn"
                          onClick={handleAiEnhanceDoc}
                          disabled={aiDocLoading}
                        >
                          {aiDocLoading ? <Loader2 className="btn-spinner" size={12} /> : <Sparkles size={12} />} ✨ AI Enhance
                        </button>
                        <button 
                          className={`admin-btn-secondary ${docMode === "preview" ? "active" : ""}`}
                          style={{ padding: "5px 10px", fontSize: "12px" }}
                          onClick={() => setDocMode(docMode === "edit" ? "preview" : "edit")}
                        >
                          <Eye size={13} /> {docMode === "edit" ? "Preview" : "Edit"}
                        </button>
                        <button 
                          className="admin-primary-btn" 
                          style={{ padding: "5px 14px", fontSize: "12px" }}
                          onClick={handleSaveDoc}
                          disabled={savingDoc}
                        >
                          {savingDoc ? <Loader2 className="btn-spinner" size={12} /> : <Check size={12} />} Save Doc
                        </button>
                        {selectedDoc?.id && (
                          <button 
                            className="user-delete-btn" 
                            style={{ padding: "5px 10px" }}
                            onClick={() => handleDeleteDoc(selectedDoc.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="docs-content-area">
                      {docMode === "edit" ? (
                        <textarea 
                          className="admin-textarea" 
                          value={docContent} 
                          onChange={(e) => setDocContent(e.target.value)}
                          placeholder="Write markdown technical documentation here..."
                          style={{ width: "100%", height: "100%", minHeight: "360px", fontFamily: "monospace", fontSize: "13px", resize: "none" }}
                        />
                      ) : (
                        <div style={{ background: "var(--team-card-inner-bg, #121214)", border: "1px solid var(--team-border)", padding: "20px", borderRadius: "8px", color: "var(--team-text, #e4e4e7)", lineHeight: "1.6", whiteSpace: "pre-wrap", fontFamily: "sans-serif" }}>
                          {docContent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Shared Prompts & Runner */}
            {activeTab === "prompts" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "700", color: "var(--team-text)" }}>Enterprise Prompt Vault</h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--team-text-muted)" }}>Standardized team prompt library with instant live sandbox execution.</p>
                  </div>
                  <button 
                    className="admin-primary-btn" 
                    onClick={() => setCreatePromptModal(true)}
                  >
                    <Plus size={14} /> Add Shared Prompt
                  </button>
                </div>

                <div className="prompts-grid">
                  {prompts.length === 0 ? (
                    <div style={{ textAlign: "center", gridColumn: "1/-1", padding: "40px", color: "#a1a1aa" }}>
                      No shared enterprise prompts created yet. Add one for your team!
                    </div>
                  ) : prompts.map(p => (
                    <div key={p.id} className="prompt-card">
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="prompt-title">{p.title}</span>
                          <span className="user-stats-badges badge-cyan" style={{ fontSize: "10px" }}>{p.category}</span>
                        </div>
                        <div className="prompt-text">{p.prompt_text}</div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                        <span style={{ fontSize: "11px", color: "#71717a" }}>By {p.author_email}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button 
                            className="admin-primary-btn" 
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => {
                              setPromptToRun(p);
                              setPromptRunOutput("");
                              setRunPromptModal(true);
                            }}
                            title="Execute Prompt in Sandbox"
                          >
                            <Play size={12} /> Run
                          </button>
                          <button 
                            className="admin-btn-secondary" 
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => {
                              navigator.clipboard.writeText(p.prompt_text);
                              setCopiedPromptId(p.id);
                              setTimeout(() => setCopiedPromptId(null), 2000);
                            }}
                          >
                            {copiedPromptId === p.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                          <button 
                            className="user-delete-btn" 
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleDeletePrompt(p.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: Departmental Quotas & Telemetry */}
            {activeTab === "analytics" && (
              <div>
                {analyticsLoading ? (
                  <div style={{ textAlign: "center", padding: "60px" }}>
                    <Loader2 className="btn-spinner" size={32} style={{ margin: "0 auto" }} />
                    <p style={{ color: "#a1a1aa", marginTop: "12px" }}>Computing department token consumption & quota telemetry...</p>
                  </div>
                ) : analyticsData && (
                  <div>
                    {/* Top KPI Cards */}
                    <div className="analytics-metrics-grid">
                      <div className="analytics-stat-card">
                        <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>Monthly Budget Status</span>
                        <div className="analytics-stat-val">${analyticsData.budget?.current_spend_usd} / ${analyticsData.budget?.monthly_cap_usd}</div>
                        <div className="budget-progress-bg">
                          <div className="budget-progress-fill" style={{ width: `${analyticsData.budget?.utilization_pct}%` }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "6px", display: "block" }}>
                          {analyticsData.budget?.utilization_pct}% utilized ({analyticsData.budget?.status})
                        </span>
                      </div>

                      <div className="analytics-stat-card">
                        <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>Sprint Velocity</span>
                        <div className="analytics-stat-val">{analyticsData.metrics?.tasks_completed} / {analyticsData.metrics?.total_tasks} Tasks</div>
                        <span style={{ fontSize: "11px", color: "#4ade80", marginTop: "6px", display: "block" }}>
                          {analyticsData.metrics?.completion_rate_pct}% completion rate
                        </span>
                      </div>

                      <div className="analytics-stat-card">
                        <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>Team AI Interactions</span>
                        <div className="analytics-stat-val">{analyticsData.metrics?.channel_messages + analyticsData.metrics?.shared_prompts}</div>
                        <span style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "6px", display: "block" }}>
                          Across {channels.length} channels & prompts
                        </span>
                      </div>

                      <div className="analytics-stat-card">
                        <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "600" }}>Tokens Consumed (30D)</span>
                        <div className="analytics-stat-val">{analyticsData.metrics?.total_tokens_month?.toLocaleString()}</div>
                        <span style={{ fontSize: "11px", color: "#60a5fa", marginTop: "6px", display: "block" }}>
                          Smart semantic routing active
                        </span>
                      </div>
                    </div>

                    {/* Model Distribution & Member Breakdown */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "16px", marginTop: "16px" }}>
                      <div className="admin-card">
                        <div className="admin-card-header">
                          <h3>Model Cost Routing Breakdown</h3>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
                          {analyticsData.model_distribution?.map((m, idx) => (
                            <div key={idx}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                                <span style={{ fontWeight: "600", color: "var(--team-text)" }}>{m.model}</span>
                                <span style={{ color: "var(--team-text-muted)" }}>{m.percentage}% ({m.requests} reqs)</span>
                              </div>
                              <div className="budget-progress-bg">
                                <div className="budget-progress-fill" style={{ width: `${m.percentage}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="admin-card">
                        <div className="admin-card-header">
                          <h3>Member Token & Resource Allocation</h3>
                        </div>
                        <div className="users-table-container">
                          <table className="admin-users-table">
                            <thead>
                              <tr>
                                <th>Member</th>
                                <th>Tasks</th>
                                <th>Tokens Used</th>
                                <th>Cost (USD)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsData.member_breakdown?.map((mb, idx) => (
                                <tr key={idx}>
                                  <td style={{ fontWeight: "600", fontSize: "12px" }}>{mb.email}</td>
                                  <td>{mb.tasks_assigned}</td>
                                  <td>{mb.tokens_consumed?.toLocaleString()}</td>
                                  <td style={{ color: "#4ade80", fontWeight: "600" }}>${mb.cost_usd}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Members */}
            {activeTab === "members" && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Organization Members & Permissions</h3>
                  <span className="user-stats-badges badge-cyan">RBAC Active</span>
                </div>
                <div className="users-table-container">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Email / Member</th>
                        <th>Role</th>
                        <th>Joined Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeam.members?.map((m, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: "600", fontSize: "13px" }}>
                            {m.email} {m.email === user?.email && <span style={{ color: "#a1a1aa", fontSize: "11px" }}>(You)</span>}
                          </td>
                          <td>
                            <span className={`user-stats-badges ${m.role === "admin" ? "badge-yellow" : "badge-cyan"}`} style={{ textTransform: "uppercase" }}>
                              {m.role}
                            </span>
                          </td>
                          <td className="user-date-display">{m.joined_at?.substring(0, 10)}</td>
                          <td>
                            {m.email !== user?.email && (
                              <button 
                                className="user-delete-btn"
                                onClick={() => handleRemoveMember(m.email)}
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 7: Activity Feed */}
            {activeTab === "activity" && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Live Team Collaborative Stream</h3>
                </div>
                <div className="users-table-container">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.length === 0 ? (
                        <tr><td colSpan="4" className="table-empty">No activity recorded yet.</td></tr>
                      ) : activities.map((act, idx) => (
                        <tr key={idx}>
                          <td className="user-date-display" style={{ whiteSpace: "nowrap" }}>{act.timestamp?.replace("T", " ").substring(0, 19)}</td>
                          <td style={{ fontWeight: "600", fontSize: "12px" }}>{act.user_email}</td>
                          <td>
                            <span className="user-stats-badges badge-cyan">{act.action}</span>
                          </td>
                          <td style={{ fontSize: "13px" }}>{act.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 8: Settings & Danger Zone */}
            {activeTab === "settings" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3>Workspace Information & Configuration</h3>
                  </div>
                  <form onSubmit={handleUpdateTeam} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
                    <div className="admin-input-group">
                      <label>Workspace Name *</label>
                      <input 
                        type="text" 
                        className="admin-input" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="admin-input-group">
                      <label>Workspace Description</label>
                      <input 
                        type="text" 
                        className="admin-input" 
                        value={editDesc} 
                        onChange={(e) => setEditDesc(e.target.value)} 
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
                      <div className="admin-input-group">
                        <label>Workspace ID</label>
                        <input type="text" className="admin-input" value={selectedTeam.id} readOnly style={{ opacity: 0.6 }} />
                      </div>
                      <div className="admin-input-group">
                        <label>Created Date</label>
                        <input type="text" className="admin-input" value={selectedTeam.created_at?.substring(0, 10) || "N/A"} readOnly style={{ opacity: 0.6 }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                      <button type="submit" className="admin-primary-btn" disabled={updatingTeam}>
                        {updatingTeam ? <Loader2 className="btn-spinner" size={14} /> : <Check size={14} />} Save Settings
                      </button>
                    </div>
                  </form>
                </div>

                {(() => {
                  const isOwner = selectedTeam && (
                    (selectedTeam.owner_email && selectedTeam.owner_email.toLowerCase() === user?.email?.toLowerCase()) ||
                    (selectedTeam.owner_id && String(selectedTeam.owner_id) === String(user?.id || user?._id || user?.sub))
                  );
                  const currentMember = selectedTeam?.members?.find((m) => m.email?.toLowerCase() === user?.email?.toLowerCase());
                  const isAdmin = currentMember?.role === "admin" || user?.role === "admin";
                  const canDelete = isOwner || isAdmin;

                  return (
                    <div className="admin-card" style={{ borderColor: canDelete ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)", background: canDelete ? "rgba(239, 68, 68, 0.03)" : "rgba(245, 158, 11, 0.03)" }}>
                      <div className="admin-card-header" style={{ borderBottomColor: canDelete ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <AlertTriangle size={18} style={{ color: canDelete ? "#ef4444" : "#f59e0b" }} />
                          <h3 style={{ color: canDelete ? "#ef4444" : "#f59e0b" }}>
                            {canDelete ? "Danger Zone" : "Workspace Membership"}
                          </h3>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                          <h4 style={{ color: "var(--team-text)", fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>
                            {canDelete ? `Delete this Workspace (${selectedTeam.name})` : `Leave this Workspace (${selectedTeam.name})`}
                          </h4>
                          <p style={{ color: "var(--team-text-muted)", fontSize: "12px", maxWidth: "560px" }}>
                            {canDelete
                              ? "Permanently delete this active workspace, all shared channels, tasks, docs, and collaboration telemetry. Only the workspace creator and admins have permission."
                              : "Leave this team workspace. You will no longer have access to channels, docs, or sprint tasks unless re-invited by a team admin."}
                          </p>
                        </div>
                        {canDelete ? (
                          <button
                            type="button"
                            className="user-delete-btn"
                            style={{ padding: "8px 18px", fontSize: "13px" }}
                            onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                          >
                            <Trash2 size={15} /> Delete Workspace
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="user-delete-btn"
                            style={{
                              padding: "8px 18px",
                              fontSize: "13px",
                              background: "rgba(245, 158, 11, 0.15)",
                              borderColor: "rgba(245, 158, 11, 0.35)",
                              color: "#f59e0b",
                            }}
                            onClick={() => handleLeaveTeam(selectedTeam.id, selectedTeam.name)}
                          >
                            <LogOut size={15} /> Leave Workspace
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Team */}
        {createTeamModal && (
          <div className="admin-modal-backdrop" onClick={() => setCreateTeamModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Create Team Space</h3>
              <form onSubmit={handleCreateTeam} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Team / Organization Name *</label>
                  <input type="text" className="admin-input" placeholder="e.g. Acme Engineering" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} required />
                </div>
                <div className="admin-input-group">
                  <label>Description</label>
                  <input type="text" className="admin-input" placeholder="e.g. Core product and DevOps team" value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setCreateTeamModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Create Workspace</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Channel */}
        {createChannelModal && (
          <div className="admin-modal-backdrop" onClick={() => setCreateChannelModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Create Channel</h3>
              <form onSubmit={handleCreateChannel} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Channel Name * (e.g. api-infra, security)</label>
                  <input type="text" className="admin-input" placeholder="api-infra" value={newChanName} onChange={(e) => setNewChanName(e.target.value)} required />
                </div>
                <div className="admin-input-group">
                  <label>Topic / Description</label>
                  <input type="text" className="admin-input" placeholder="Discussions on backend & cloud architecture" value={newChanTopic} onChange={(e) => setNewChanTopic(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setCreateChannelModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Create Channel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Kanban Task */}
        {createTaskModal && (
          <div className="admin-modal-backdrop" onClick={() => setCreateTaskModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Add Sprint Task</h3>
              <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Task Title *</label>
                  <input type="text" className="admin-input" placeholder="e.g. Integrate OAuth2 Google Login" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
                </div>
                <div className="admin-input-group">
                  <label>Description</label>
                  <textarea className="admin-textarea" rows={3} placeholder="Task details and acceptance criteria..." value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="admin-input-group">
                    <label>Priority</label>
                    <select className="admin-select" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="admin-input-group">
                    <label>Assignee Email</label>
                    <input type="email" className="admin-input" placeholder={user?.email} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} />
                  </div>
                </div>
                <div className="admin-input-group">
                  <label>Tags (Comma-separated)</label>
                  <input type="text" className="admin-input" placeholder="Backend, Auth, Security" value={taskTags} onChange={(e) => setTaskTags(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setCreateTaskModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Create Task</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: AI Sprint Planner */}
        {aiSprintModal && (
          <div className="admin-modal-backdrop" onClick={() => setAiSprintModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} style={{ color: "#ffffff" }} />
                <h3>✨ AI Sprint Planner</h3>
              </div>
              <p style={{ fontSize: "13px", color: "#a1a1aa", marginTop: "6px" }}>
                Describe your high-level project goal or milestone. NexusAI will decompose it into structured engineering cards.
              </p>
              <form onSubmit={handleAiAiSprintBreakdown => handleAiSprintBreakdown(handleAiAiSprintBreakdown)} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Sprint Goal / Objective *</label>
                  <textarea 
                    className="admin-textarea" 
                    rows={3} 
                    placeholder="e.g. Build Stripe Checkout subscription billing with Webhooks & customer portal" 
                    value={sprintGoal} 
                    onChange={(e) => setSprintGoal(e.target.value)} 
                    required 
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setAiSprintModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn" disabled={aiSprintLoading}>
                    {aiSprintLoading ? <Loader2 className="btn-spinner" size={14} /> : <Sparkles size={14} />} Generate Task Cards
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Run Shared Prompt */}
        {runPromptModal && promptToRun && (
          <div className="admin-modal-backdrop" onClick={() => setRunPromptModal(false)}>
            <div className="admin-modal-card" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Play size={18} style={{ color: "#ffffff" }} />
                <h3>Execute Shared Prompt: {promptToRun.title}</h3>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "6px", fontSize: "12px", color: "#a1a1aa", marginTop: "10px" }}>
                {promptToRun.prompt_text}
              </div>

              <div style={{ marginTop: "14px" }}>
                <button 
                  className="admin-primary-btn" 
                  onClick={handleRunPromptExecute}
                  disabled={runningPrompt}
                >
                  {runningPrompt ? <Loader2 className="btn-spinner" size={14} /> : <Play size={14} />} Run in Sandbox
                </button>
              </div>

              {promptRunOutput && (
                <div style={{ marginTop: "14px", background: "var(--team-card-inner-bg, #121214)", border: "1px solid var(--team-border)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--team-text)", display: "block", marginBottom: "6px" }}>
                    LLM Execution Result:
                  </span>
                  <div style={{ fontSize: "13px", color: "var(--team-text)", lineHeight: "1.5", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                    {promptRunOutput}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button type="button" className="admin-refresh-btn" onClick={() => setRunPromptModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Invite Member */}
        {inviteModal && (
          <div className="admin-modal-backdrop" onClick={() => setInviteModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Invite Team Member</h3>
              <form onSubmit={handleInviteMember} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Member Email *</label>
                  <input type="email" className="admin-input" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </div>
                <div className="admin-input-group">
                  <label>Assigned Role</label>
                  <select className="admin-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">Member (Can chat, task & access shared wiki)</option>
                    <option value="admin">Admin (Can invite & manage team settings)</option>
                    <option value="viewer">Viewer (Read-only access)</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setInviteModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Send Invite</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Prompt */}
        {createPromptModal && (
          <div className="admin-modal-backdrop" onClick={() => setCreatePromptModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Save Shared Prompt Template</h3>
              <form onSubmit={handleCreatePrompt} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Prompt Title *</label>
                  <input type="text" className="admin-input" placeholder="e.g. Microservice Architecture Review" value={promptTitle} onChange={(e) => setPromptTitle(e.target.value)} required />
                </div>
                <div className="admin-input-group">
                  <label>Category</label>
                  <select className="admin-select" value={promptCategory} onChange={(e) => setPromptCategory(e.target.value)}>
                    <option value="Engineering">Engineering & Architecture</option>
                    <option value="Marketing">Marketing & Copywriting</option>
                    <option value="Legal">Legal & Contract Review</option>
                    <option value="CustomerSupport">Customer Support SOP</option>
                  </select>
                </div>
                <div className="admin-input-group">
                  <label>Prompt Content *</label>
                  <textarea className="admin-textarea" rows={4} placeholder="Write the reusable prompt template..." value={promptText} onChange={(e) => setPromptText(e.target.value)} required />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setCreatePromptModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Save Prompt</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

export default TeamWorkspacePage;
