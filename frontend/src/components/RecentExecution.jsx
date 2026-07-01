import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "./RecentExecution.css";

function RecentExecution() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExecs() {
      try {
        const res = await api.get("/ai/executions");
        setExecutions(res.data || []);
      } catch (err) {
        console.error("Failed to load executions for dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExecs();
  }, []);

  return (
    <div className="execution-card">
      <div className="section-header">
        <h2>Recent Executions</h2>
      </div>

      {loading ? (
        <div style={{ color: "#a3a3a3", fontSize: "14px", padding: "12px 0" }}>Loading...</div>
      ) : executions.length === 0 ? (
        <div style={{ color: "#a3a3a3", fontSize: "14px", padding: "12px 0" }}>No executions found.</div>
      ) : (
        executions.slice(0, 3).map((item) => {
          const name = item.project_plan?.project_name || item.idea || "Untitled Project";
          const statusStr = item.status || "Success";
          return (
            <div key={item._id} className="execution-row">
              <div>
                <Link to={`/projects/${item._id}`} style={{ textDecoration: "none" }}>
                  <h4 style={{ color: "#ffffff", hover: { color: "#cccccc" } }}>{name}</h4>
                </Link>
                <p style={{ fontSize: "11px", color: "#a3a3a3", marginTop: "4px" }}>ID: {item._id}</p>
              </div>
              <span className={`status ${statusStr.toLowerCase()}`}>
                {statusStr}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default RecentExecution;