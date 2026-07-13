import { useState, useEffect } from "react";
import { useWorkspace } from "../contexts/WorkspaceContext";
import DashboardLayout from "../layouts/DashboardLayout";
import ResearchHistory from "../components/research/ResearchHistory";
import ResearchPanel from "../components/research/ResearchPanel";
import api from "../services/api";
import "./GenerateProject.css";

function ResearchWorkspace() {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const { activeModule, switchModule } = useWorkspace();

  useEffect(() => {
    if (activeModule !== "research") {
      switchModule("research");
    }
  }, [activeModule, switchModule]);

  async function loadSession(session) {
    try {
      setLoading(true);
      const response = await api.get(`/research/sessions/${session._id}`);
      setSelected({
        agent: "research",
        research_session_id: response.data._id,
        status: response.data.status,
        plan: response.data.plan,
        findings: response.data.findings,
        report: response.data.report,
        review: response.data.review,
        sources: response.data.sources,
        timeline: response.data.timeline,
        report_file: {
          name: `research-report-${response.data._id}.md`,
          content: response.data.report,
          mime_type: "text/markdown",
        },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="workspace-page">
        <div className="workspace-header">
          <div>
            <div className="workspace-badge"><span>Research AI</span></div>
            <h1>Research Workspace</h1>
            <p>Browse saved research reports, review timeline steps, and continue from the main AI workspace.</p>
          </div>
        </div>

        <ResearchHistory onSelect={loadSession} />
        {loading && <div className="loading-card">Loading selected research...</div>}
        {selected && <ResearchPanel result={selected} />}
      </div>
    </DashboardLayout>
  );
}

export default ResearchWorkspace;