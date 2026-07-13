/**
 * WorkspaceContext.jsx
 *
 * Single source of truth for the NexusAI workspace.
 *
 * Manages:
 *  - activeModule (engineer | conversational | research | education | automation)
 *  - Per-module conversation history (loaded from MongoDB, no localStorage)
 *  - Active conversation ID per module
 *  - Message state per module
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";
import { listAutomationConversations, getAutomationConversation } from "../services/AutomationApi";

const WorkspaceContext = createContext(null);

const MODULES = ["engineer", "conversational", "research", "education", "automation", "brain", "mcp"];

// ── Initial per-module state ─────────────────────────────────────────────────
function makeModuleState() {
  const state = {};
  MODULES.forEach((m) => {
    state[m] = {
      conversations: [],    // sidebar list (no messages)
      activeId: null,       // active conversation ID
      messages: [],         // messages in active conversation
      result: null,         // engineer/research/automation result object
      loading: false,
    };
  });
  return state;
}

export function WorkspaceProvider({ children }) {
  const [activeModule, setActiveModule] = useState("engineer");
  const [moduleState, setModuleState] = useState(makeModuleState);
  const [historyLoaded, setHistoryLoaded] = useState({});

  // ── Update helper ─────────────────────────────────────────────────────────
  function updateModule(module, patch) {
    setModuleState((prev) => ({
      ...prev,
      [module]: { ...prev[module], ...patch },
    }));
  }

  // ── Load sidebar history for a module ─────────────────────────────────────
  const loadHistory = useCallback(async (module) => {
    if (historyLoaded[module] || module === "brain" || module === "mcp") return;

    try {
      let conversations = [];

      if (module === "automation") {
        conversations = await listAutomationConversations();
      } else if (module === "research") {
        const res = await api.get("/research/sessions");
        conversations = res.data || [];
      } else {
        const res = await api.get(`/conversations/?agent_type=${module}`);
        conversations = res.data || [];
      }

      updateModule(module, { conversations });
      setHistoryLoaded((prev) => ({ ...prev, [module]: true }));
    } catch {
      updateModule(module, { conversations: [] });
    }
  }, [historyLoaded]);

  // Load history when module becomes active
  useEffect(() => {
    loadHistory(activeModule);
  }, [activeModule]);

  // ── Switch active module ───────────────────────────────────────────────────
  function switchModule(module) {
    setActiveModule(module);
  }

  // ── Start a new chat for the current module ───────────────────────────────
  function newChat(module = activeModule) {
    updateModule(module, {
      activeId: null,
      messages: [],
      result: null,
    });
  }

  // ── Load a specific conversation ──────────────────────────────────────────
  async function loadConversation(module, id) {
    try {
      updateModule(module, { loading: true });

      let messages = [];
      let result = null;

      if (module === "automation") {
        const conv = await getAutomationConversation(id);
        messages = (conv.messages || []).map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content,
          result: m.result || null,
          attachments: m.attachments || null
        }));
      } else if (module === "research") {
        const res = await api.get(`/research/sessions/${id}`);
        const conv = res.data;
        messages = (conv.messages || []).map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content,
          result: m.role === "assistant" ? conv : null,
          attachments: m.attachments || null
        }));
        result = conv;
      } else {
        const res = await api.get(`/conversations/${id}`);
        const conv = res.data;
        
        const actualModule = conv.agent_type || "conversational";
        if (actualModule !== module) {
          // Prevent mixing module states - redirect load to the correct module
          loadConversation(actualModule, id);
          return;
        }

        messages = (conv.messages || []).map((m, i) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content,
          result: m.result || null,
          attachments: m.attachments || null
        }));
        // If module has a structured result in last assistant message, extract it
        if (["engineer"].includes(module)) {
          const last = [...messages].reverse().find((m) => m.role === "assistant");
          if (last?.result) result = last.result;
        }
      }

      if (module !== activeModule) setActiveModule(module);
      updateModule(module, { activeId: id, messages, result, loading: false });
    } catch (err) {
      console.error("Failed to load conversation:", err);
      updateModule(module, { activeId: null, messages: [], result: null, loading: false });
    }
  }

  // ── Refresh history list for a module (after new conversation created) ────
  async function refreshHistory(module) {
    setHistoryLoaded((prev) => ({ ...prev, [module]: false }));
    // Will be re-fetched on next effect
    setTimeout(() => loadHistory(module), 100);
  }

  // ── Set messages for a module ─────────────────────────────────────────────
  function setMessages(module, msgs) {
    if (typeof msgs === "function") {
      setModuleState((prev) => ({
        ...prev,
        [module]: {
          ...prev[module],
          messages: msgs(prev[module].messages)
        }
      }));
    } else {
      updateModule(module, { messages: msgs });
    }
  }

  // ── Set result for a module ───────────────────────────────────────────────
  function setResult(module, result) {
    updateModule(module, { result });
  }

  // ── Set activeId for a module ─────────────────────────────────────────────
  function setActiveId(module, id) {
    updateModule(module, { activeId: id });
  }

  // ── Set loading for a module ──────────────────────────────────────────────
  function setLoading(module, loading) {
    updateModule(module, { loading });
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const value = {
    activeModule,
    switchModule,
    moduleState,
    newChat,
    loadConversation,
    loadHistory,
    refreshHistory,
    setMessages,
    setResult,
    setActiveId,
    setLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    isNavbarVisible,
    setIsNavbarVisible,
    directoryModalOpen,
    setDirectoryModalOpen,
    profileModalOpen,
    setProfileModalOpen,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
