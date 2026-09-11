import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Executions from "./pages/Executions";
import GenerateProject from "./pages/GenerateProject";
import Login from "./pages/Login";
import ProjectDetails from "./pages/ProjectDetails";
import Projects from "./pages/Projects";
import Signup from "./pages/Signup";
import ResearchHistoryPage from "./pages/ResearchHistoryPage";
import EducationHistoryPage from "./pages/EducationHistoryPage";
import AutomationHistoryPage from "./pages/AutomationHistoryPage";
import WorkspacePage from "./pages/WorkspacePage";
import VerifyOtp from "./pages/VerifyOtp";
import AdminPanel from "./pages/AdminPanel";
import McpPage from "./pages/McpPage";
import AgentStudioPage from "./pages/AgentStudioPage";
import TeamWorkspacePage from "./pages/TeamWorkspacePage";
import IntegrationsHubPage from "./pages/IntegrationsHubPage";
import DocsPage from "./pages/DocsPage";
import CareersPage from "./pages/CareersPage";
import PublicAgentChat from "./pages/PublicAgentChat";
import SharedChatPage from "./pages/SharedChatPage";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

import TeamInviteNotification from "./components/workspace/TeamInviteNotification";

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ChatProvider>
          <BrowserRouter>
            <TeamInviteNotification />
            <Routes>
              <Route path="/" element={<Navigate to="/workspace" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/workspace" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <WorkspacePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/generate"
                element={
                  <ProtectedRoute>
                    <Navigate to="/workspace" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute>
                    <Projects />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/research"
                element={
                  <ProtectedRoute>
                    <ResearchHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/education"
                element={
                  <ProtectedRoute>
                    <EducationHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/automation"
                element={
                  <ProtectedRoute>
                    <AutomationHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:id"
                element={
                  <ProtectedRoute>
                    <ProjectDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executions"
                element={
                  <ProtectedRoute>
                    <Executions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mcp"
                element={
                  <ProtectedRoute>
                    <McpPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agent-studio"
                element={
                  <ProtectedRoute>
                    <AgentStudioPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams"
                element={
                  <ProtectedRoute>
                    <TeamWorkspacePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team-workspace"
                element={
                  <ProtectedRoute>
                    <TeamWorkspacePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/integrations"
                element={
                  <ProtectedRoute>
                    <IntegrationsHubPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/careers" element={<CareersPage />} />
              {/* Public agent chat — no login required */}
              <Route path="/chat/agent/:agentId" element={<PublicAgentChat />} />
              {/* Public shared chat conversations for all 5 models — no login required */}
              <Route path="/share/chat/:id" element={<SharedChatPage />} />
              <Route path="/shared/:id" element={<SharedChatPage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Navigate to="/workspace" />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;