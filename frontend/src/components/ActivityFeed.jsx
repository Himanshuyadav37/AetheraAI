import { useEffect, useState } from "react";
import api from "../services/api";
import "./ActivityFeed.css";

function ActivityFeed() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await api.get("/ai/executions");
        const list = res.data || [];

        // Gather all execution steps
        const allSteps = [];
        list.forEach((exec) => {
          const steps = exec.execution_steps || [];
          const projName = exec.project_plan?.project_name || exec.idea || "Project";
          
          steps.forEach((step) => {
            allSteps.push({
              id: exec._id + "-" + step.step,
              project: projName,
              message: `${projName}: ${step.message || step.description || "Step completed"}`,
              time: step.timestamp || exec.created_at || new Date().toISOString()
            });
          });
        });

        // Sort by time descending (latest first)
        allSteps.sort((a, b) => new Date(b.time) - new Date(a.time));
        setLogs(allSteps.slice(0, 5));
      } catch (err) {
        console.error("Failed to load activity logs", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="activity-card">
      <h2>Activity Feed</h2>

      {loading ? (
        <div style={{ color: "#a3a3a3", fontSize: "14px", padding: "12px 0" }}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={{ color: "#a3a3a3", fontSize: "14px", padding: "12px 0" }}>No recent activity.</div>
      ) : (
        logs.map((item) => (
          <div key={item.id} className="activity-item">
            <span />
            {item.message}
          </div>
        ))
      )}
    </div>
  );
}

export default ActivityFeed;