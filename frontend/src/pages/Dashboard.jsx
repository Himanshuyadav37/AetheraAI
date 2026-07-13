import DashboardLayout from "../layouts/DashboardLayout";

import HeroSection from "../components/HeroSection";
import AgentTimeline from "../components/AgentTimeline";
import RecentExecution from "../components/RecentExecution";
import ActivityFeed from "../components/ActivityFeed";

import "./Dashboard.css";

function Dashboard() {

  return (

    <DashboardLayout>

      <HeroSection />

      <div className="middle-grid">

        <AgentTimeline />

        <div className="module-card">
          <div className="module-header">
            <h2>NexusAI Modules</h2>
            <span>Ecosystem</span>
          </div>

          <div className="module active">
            <div>
              <h4>Engineer</h4>
              <p>Multi-Agent Software Development</p>
            </div>
            <strong>ACTIVE</strong>
          </div>

          <div className="module active">
            <div>
              <h4>Conversational</h4>
              <p>AI Assistant Platform</p>
            </div>
            <strong>ACTIVE</strong>
          </div>

          <div className="module active">
            <div>
              <h4>Research</h4>
              <p>Autonomous Research Agents</p>
            </div>
            <strong>ACTIVE</strong>
          </div>

          <div className="module active">
            <div>
              <h4>Education</h4>
              <p>Personal AI Tutor</p>
            </div>
            <strong>ACTIVE</strong>
          </div>

          <div className="module active">
            <div>
              <h4>Automation</h4>
              <p>Workflow Automation Engine</p>
            </div>
            <strong>ACTIVE</strong>
          </div>
        </div>

      </div>

      <div className="bottom-grid">

        <RecentExecution />

        <ActivityFeed />

      </div>

    </DashboardLayout>

  );

}

export default Dashboard;