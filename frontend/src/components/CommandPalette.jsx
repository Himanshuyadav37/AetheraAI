import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Code2,
  Cpu,
  GraduationCap,
  Workflow,
  Database,
  Brain,
  Settings,
  BookOpen,
  Users,
  ShieldCheck,
  Moon,
  Sun,
  Sparkles,
  Command,
  ArrowRight,
  ExternalLink,
  Layers,
  Zap,
  FolderGit2,
  PlusCircle,
  MessageSquare
} from "lucide-react";
import "./CommandPalette.css";

const getCommandGroups = (toggleTheme) => [
  {
    category: "⚡ Quick Start & Actions",
    items: [
      {
        id: "qs-docs",
        title: "5-Minute Quickstart Guide",
        description: "Step-by-step developer guide to API keys, SDKs & agents",
        icon: Zap,
        path: "/docs",
        shortcut: "Q S"
      },
      {
        id: "qs-chat",
        title: "New Conversational Session",
        description: "Start fresh context-aware AI chat with web & RAG",
        icon: MessageSquare,
        path: "/workspace?agent=conversational",
        shortcut: "N C"
      },
      {
        id: "qs-engineer",
        title: "Launch Autonomous Code Engineer",
        description: "Full-stack code generation, debugging & live preview",
        icon: Code2,
        path: "/workspace?agent=engineer",
        shortcut: "N E"
      },
      {
        id: "qs-theme",
        title: "Toggle Dark / Light Theme",
        description: "Switch between Enterprise Dark and Crisp Light Mode",
        icon: Sun,
        action: toggleTheme,
        shortcut: "T T"
      }
    ]
  },
  {
    category: "Agents & Workspaces",
    items: [
      {
        id: "ws-engineer",
        title: "Engineer AI Workspace",
        description: "Autonomous code generation, debugging, and live preview",
        icon: Code2,
        path: "/workspace?agent=engineer",
        shortcut: "G E"
      },
      {
        id: "ws-research",
        title: "Research AI Workspace",
        description: "Deep competitor analysis, web intelligence, and synthesis",
        icon: Cpu,
        path: "/workspace?agent=research",
        shortcut: "G R"
      },
      {
        id: "ws-education",
        title: "Education AI Workspace",
        description: "Interactive learning, code tutoring, and architectural guides",
        icon: GraduationCap,
        path: "/workspace?agent=education",
        shortcut: "G D"
      },
      {
        id: "ws-automation",
        title: "Automation AI & Workflows",
        description: "Backend flows, task scheduling, and n8n webhooks",
        icon: Workflow,
        path: "/workspace?agent=automation",
        shortcut: "G A"
      },
      {
        id: "ws-studio",
        title: "Agent Studio",
        description: "Create and customize custom autonomous agents",
        icon: Sparkles,
        path: "/agent-studio",
        shortcut: "G S"
      }
    ]
  },
  {
    category: "Cloud Vector DB & Memory",
    items: [
      {
        id: "rag-pinecone",
        title: "Pinecone Cloud Knowledge Base",
        description: "Manage vector indexes, multi-tenant namespaces, and embeddings",
        icon: Database,
        path: "/workspace?tab=knowledge",
        shortcut: "P K"
      },
      {
        id: "mem-learnings",
        title: "Autonomous Learned Rules",
        description: "View continuous learnings and user preferences",
        icon: Brain,
        path: "/workspace?tab=memory",
        shortcut: "P M"
      }
    ]
  },
  {
    category: "Platform & Team",
    items: [
      {
        id: "team-workspace",
        title: "Team Organizations & RBAC",
        description: "Collaborative workspaces, members, and shared knowledge",
        icon: Users,
        path: "/teams",
        shortcut: "G T"
      },
      {
        id: "integrations",
        title: "Dynamic MCP Integrations Hub",
        description: "Connect GitHub, PostgreSQL, Docker, and SSE endpoints",
        icon: Layers,
        path: "/integrations",
        shortcut: "G I"
      },
      {
        id: "admin-panel",
        title: "Admin Command Center",
        description: "System health, API keys, telemetry, and audit logs",
        icon: ShieldCheck,
        path: "/admin",
        shortcut: "G X"
      },
      {
        id: "docs",
        title: "Developer Documentation & API",
        description: "SDK references, agent orchestration guides, and MCP specs",
        icon: BookOpen,
        path: "/docs",
        shortcut: "G H"
      }
    ]
  }
];

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const toggleTheme = () => {
    const isLight = document.body.classList.contains("light");
    if (isLight) {
      document.body.classList.remove("light");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  const commandGroups = getCommandGroups(toggleTheme);

  // Flattened filtered items for keyboard navigation
  const filteredGroups = commandGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        group.category.toLowerCase().includes(query.toLowerCase())
    )
  })).filter((group) => group.items.length > 0);

  const flatItems = filteredGroups.flatMap((g) => g.items);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === "Enter" && flatItems[selectedIndex]) {
      e.preventDefault();
      executeItem(flatItems[selectedIndex]);
    }
  };

  const executeItem = (item) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  if (!isOpen) return null;

  let currentFlatIdx = -1;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose}>
      <div
        className="cmd-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Header */}
        <div className="cmd-palette-header">
          <Search className="cmd-search-icon" size={18} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Search agents, Pinecone knowledge, workspaces, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cmd-badge-hint">
            <span>ESC</span>
          </div>
        </div>

        {/* Results List */}
        <div className="cmd-palette-body">
          {flatItems.length === 0 ? (
            <div className="cmd-empty-state">
              <Sparkles size={28} className="cmd-empty-icon" />
              <p>No matching commands found for "{query}"</p>
              <span>Try searching for "Engineer", "Pinecone", or "Settings"</span>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.category} className="cmd-group">
                <div className="cmd-group-label">{group.category}</div>
                {group.items.map((item) => {
                  currentFlatIdx++;
                  const isSelected = currentFlatIdx === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`cmd-item ${isSelected ? "selected" : ""}`}
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIdx)}
                    >
                      <div className="cmd-item-icon-box">
                        <Icon size={16} />
                      </div>
                      <div className="cmd-item-details">
                        <div className="cmd-item-title">{item.title}</div>
                        <div className="cmd-item-desc">{item.description}</div>
                      </div>
                      {item.shortcut && (
                        <span className="cmd-item-shortcut">{item.shortcut}</span>
                      )}
                      <ArrowRight size={14} className="cmd-item-arrow" />
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info bar */}
        <div className="cmd-palette-footer">
          <div className="cmd-footer-hints">
            <span className="cmd-key-badge">↑↓</span> Navigate
            <span className="cmd-key-badge" style={{ marginLeft: 12 }}>↵</span> Select
            <span className="cmd-key-badge" style={{ marginLeft: 12 }}>ESC</span> Close
          </div>
          <div className="cmd-footer-brand">
            <Command size={12} />
            <span>NexusAI Spotlight</span>
          </div>
        </div>
      </div>
    </div>
  );
}
