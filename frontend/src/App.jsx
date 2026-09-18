import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
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
import PublicAgentChat from "./pages/PublicAgentChat";
import SharedChatPage from "./pages/SharedChatPage";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

import TeamInviteNotification from "./components/workspace/TeamInviteNotification";
import AuthModal from "./components/auth/AuthModal";
import OnboardingModal from "./components/auth/OnboardingModal";
import { useAuth } from "./contexts/AuthContext";

function OnboardingWrapper() {
  const { user, isOnboardingOpen, completeOnboarding } = useAuth();
  if (!user || !isOnboardingOpen) return null;
  return <OnboardingModal user={user} onComplete={completeOnboarding} />;
}

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ChatProvider>
          <BrowserRouter>
            <TeamInviteNotification />
            <AuthModal />
            <OnboardingWrapper />
            <Routes>
              <Route path="/" element={<Navigate to="/workspace" replace />} />
              <Route path="/login" element={<Navigate to="/workspace" replace />} />
              <Route path="/signup" element={<Navigate to="/workspace" replace />} />
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
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/profile" replace />
                  </ProtectedRoute>
                }
              />
              <Route path="/workspace" element={<WorkspacePage />} />

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