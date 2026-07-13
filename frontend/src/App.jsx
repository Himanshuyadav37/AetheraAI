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
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ChatProvider>
          <BrowserRouter>
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