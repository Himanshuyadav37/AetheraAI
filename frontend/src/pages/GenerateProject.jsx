import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useChat } from "../contexts/ChatContext";
// ==============================
// Layout
// ==============================

import DashboardLayout from "../layouts/DashboardLayout";

// ==============================
// Common Components
// ==============================

import AgentSelector from "../components/AgentSelector";
import ChatInput from "../components/ChatInput";

// ==============================
// Agent Panels
// ==============================

import ChatPanel from "../components/ChatPanel";
// import EducationChatInput from "../components/education/ChatInput";


import EducationWorkspace from "../components/education/EducationWorkspace";
import EngineerPanel from "../components/EngineerPanel";
import ResearchPanel from "../components/ResearchPanel";
import AutomationPanel from "../components/automation/AutomationPanel";

// ==============================
// Education Components
// ==============================

// import ChatWindow from "../components/education/ChatWindow";

// ==============================
// Context
// ==============================



// ==============================
// API
// ==============================

import api from "../services/api";
// import { streamEducationAI } from "../services/EducationApi.jsx";

// ==============================
// Icons
// ==============================

import { Sparkles, Cpu, ArrowRight } from "lucide-react";

import "./GenerateProject.css";

function GenerateProject() {
  const [searchParams] = useSearchParams();

  const continueProjectId = searchParams.get("projectId");

  const continueExecutionId = searchParams.get("executionId");

  // =====================================
  // Common State
  // =====================================

  const [idea, setIdea] = useState("");

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);

  // =====================================
  // Education State
  // =====================================

  // const [educationMessages, setEducationMessages] = useState([]);

  // =====================================
  // Continue Mode
  // =====================================

  const [continueMode] = useState(false);

  // =====================================
  // Chat Context
  // =====================================

  const {
    conversationId,

    setConversationId,

    messages,

    setMessages,

    currentAgent,

    setCurrentAgent,

    refreshApp,
  } = useChat();

  useEffect(() => {
    setResult(null);
  }, [currentAgent]);

  /* =======================================
          Generate / Continue
  ======================================== */

  async function handleGenerate(prompt) {
    if (!prompt.trim()) return;

    try {
      setLoading(true);


      const payload = {
        idea: prompt,

        agent_type: currentAgent,

        conversation_id: conversationId,
      };

      if (continueMode) {
        payload.mode = "continue";

        payload.project_id = continueProjectId;

        payload.execution_id = continueExecutionId;
      }

      const response = await api.post(
        "/ai/execute-project",

        payload,
      );

      refreshApp();

      if (response.data.conversation_id) {
        setConversationId(response.data.conversation_id);
      }

      /* ============================
       Conversational AI
    ============================ */

      if (currentAgent === "conversational") {
        setMessages((prev) => [
          ...prev,

          {
            role: "user",

            content: prompt,
          },

          {
            role: "assistant",

            content: response.data.message,
          },
        ]);
      }

      /* ============================
       Engineer / Research /
       Automation
    ============================ */
      else {
        setResult(response.data);
      }
    } catch (error) {
      console.error(error);

      alert("Generation Failed");
    } finally {
      setLoading(false);
    }
  }
  /* =======================================
              Dynamic Title
  ======================================== */

  function getTitle() {
    switch (currentAgent) {
      case "engineer":
        return {
          title: "Engineer AI",

          subtitle:
            "Build production-ready software using autonomous AI agents.",
        };

      case "research":
        return {
          title: "Research AI",

          subtitle: "Deep research, competitor analysis and technical reports.",
        };

      case "education":
        return {
          title: "Education AI",

          subtitle: "Learn faster with personalized AI tutoring.",
        };

      case "automation":
        return {
          title: "Automation AI",

          subtitle: "Automate repetitive workflows using AI.",
        };

      default:
        return {
          title: "Conversational AI",

          subtitle: "Talk naturally with NexusAI.",
        };
    }
  }

  const page = getTitle();

  return (
    <DashboardLayout>
      <div className="workspace-page">
        {/* ===========================
              HEADER
      ============================ */}

        <div className="workspace-header">
          <div>
            <div className="workspace-badge">
              <Sparkles size={15} />

              <span>NexusAI Workspace</span>
            </div>

            <h1>{page.title}</h1>

            <p>{page.subtitle}</p>
          </div>

          <div className="workspace-status">
            <Cpu size={18} />

            <span>Active</span>
          </div>
        </div>

        {continueMode && (
          <div className="continue-banner">
            <ArrowRight size={16} />
            Continuing existing project. Describe what you want to build next.
          </div>
        )}

        {/* ===========================
              INPUT PANEL
      ============================ */}

        <div className="workspace-card">
          <AgentSelector
            agentType={currentAgent}
            setAgentType={setCurrentAgent}
          />

         {currentAgent !== "education" && (
  <ChatInput
    value={idea}
    onChange={setIdea}
    agentType={currentAgent}
    loading={loading}
    onSend={handleGenerate}
  />
)}
        </div>

        {/* ===========================
              OUTPUT AREA
      ============================ */}

        <div className="workspace-output">
          {/* ===========================
          ENGINEER
  =========================== */}

          {currentAgent === "engineer" && result && (
            <EngineerPanel result={result} />
          )}

          {/* ===========================
        CONVERSATIONAL
  =========================== */}

          {currentAgent === "conversational" && (
            <ChatPanel messages={messages} />
          )}

          {/* ===========================
          RESEARCH
  =========================== */}

          {currentAgent === "research" && result && (
            <ResearchPanel result={result} />
          )}

          {/* ===========================
          EDUCATION
  =========================== */}

          {currentAgent === "education" && (
  <EducationWorkspace />
)}

          {/* ===========================
        AUTOMATION
  =========================== */}

          {currentAgent === "automation" && result && (
            <AutomationPanel result={result} />
          )}

          {/* ===========================
          EMPTY STATE
  =========================== */}

          {!loading &&
  currentAgent !== "education" &&
  currentAgent !== "conversational" &&
  !result && (
    <div className="empty-state">
      <div className="empty-icon">
        <Cpu size={48} />
      </div>

      <h2>{page.title}</h2>

      <p>
        {currentAgent === "engineer"
          ? "Describe your software idea and NexusAI will automatically plan, generate, test and debug your application."
          : currentAgent === "research"
            ? "Ask NexusAI to perform technical research, market analysis or competitor research."
            : currentAgent === "education"
              ? "Start chatting with NexusAI Education AI."
              : "Create intelligent workflow automations powered by AI."}
      </p>
    </div>
)}

          {/* ===========================
          LOADING
  =========================== */}

          {loading && currentAgent !== "education" && (
            <div className="loading-card">
              <div className="loading-spinner"></div>

              <div>
                <h3>NexusAI is thinking...</h3>

                <p>
                  {currentAgent === "engineer"
                    ? "Planner, Coder, Tester and Debugger are collaborating..."
                    : "Generating response..."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default GenerateProject;
