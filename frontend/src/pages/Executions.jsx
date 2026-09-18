import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../services/api";

import "./Executions.css";

function Executions() {

  const [
    executions,
    setExecutions
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    stats,
    setStats
  ] = useState({
    total: 0,
    success: 0,
    failed: 0,
    iterations: 0
  });

  useEffect(() => {

    loadExecutions();

  }, []);

  async function loadExecutions() {

    try {

      setLoading(true);

      const response =
        await api.get(
          "/ai/executions"
        );

      const data =
        response.data || [];

      setExecutions(data);

      const successCount =
        data.filter(
          item =>
            item.status ===
            "completed"
        ).length;

      const failedCount =
        data.filter(
          item =>
            item.status ===
            "failed"
        ).length;

      const totalIterations =
        data.reduce(
          (
            acc,
            item
          ) =>
            acc +
            (
              item.iterations ||
              0
            ),
          0
        );

      setStats({

        total:
          data.length,

        success:
          successCount,

        failed:
          failedCount,

        iterations:
          totalIterations

      });

    }

    catch (err) {

      console.error(
        err
      );

    }

    finally {

      setLoading(false);

    }

  }

  return (

    <DashboardLayout>

      <div
        className="executions-page"
      >

        <div
          className="page-header"
        >

          <div>

            <h1>
              AI Executions
            </h1>

            <p>
              Monitor every
              Aethera AI
              generation run
            </p>

          </div>

          <button
            className="refresh-btn"
            onClick={
              loadExecutions
            }
          >
            Refresh
          </button>

        </div>

        <div
          className="stats-grid"
        >

          <div
            className="stat-card"
          >

            <span>
              Total Runs
            </span>

            <h2>
              {
                stats.total
              }
            </h2>

          </div>

          <div
            className="stat-card success"
          >

            <span>
              Successful
            </span>

            <h2>
              {
                stats.success
              }
            </h2>

          </div>

          <div
            className="stat-card danger"
          >

            <span>
              Failed
            </span>

            <h2>
              {
                stats.failed
              }
            </h2>

          </div>

          <div
            className="stat-card"
          >

            <span>
              Iterations
            </span>

            <h2>
              {
                stats.iterations
              }
            </h2>

          </div>

        </div>

        <div
          className="card"
        >

          <div
            className="card-header"
          >

            <h2>
              Latest AI Runs
            </h2>

          </div>

          {

            loading ? (

              <div
                className="loading"
              >

                Loading
                Executions...

              </div>

            ) :

            executions.length ===
            0 ? (

              <div
                className="empty-state"
              >

                No executions
                found

              </div>

            ) :

            (
              <>
                {/* Desktop Table View */}
                <div className="execution-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Iterations</th>
                        <th>Files</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((execution) => (
                        <tr key={execution._id}>
                          <td>
                            <strong>
                              {execution.project_plan?.project_name ||
                                execution.idea ||
                                "Untitled"}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={
                                execution.status === "completed"
                                  ? "badge success"
                                  : "badge danger"
                              }
                            >
                              {execution.status || "completed"}
                            </span>
                          </td>
                          <td>{execution.iterations || 0}</td>
                          <td>{execution.generated_code?.files?.length || 0}</td>
                          <td>
                            {execution.created_at
                              ? new Date(execution.created_at).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Stacked Cards */}
                <div className="execution-cards-mobile">
                  {executions.map((execution) => (
                    <div key={execution._id} className="execution-mobile-card">
                      <div className="execution-mobile-card-top">
                        <span className="execution-mobile-title">
                          {execution.project_plan?.project_name ||
                            execution.idea ||
                            "Untitled Project"}
                        </span>
                        <span
                          className={`badge ${
                            execution.status === "completed" ? "success" : "danger"
                          }`}
                        >
                          {execution.status || "completed"}
                        </span>
                      </div>

                      <div className="execution-mobile-meta-grid">
                        <div className="execution-meta-item">
                          <span className="execution-meta-label">Iterations</span>
                          <span className="execution-meta-val">{execution.iterations || 0}</span>
                        </div>
                        <div className="execution-meta-item">
                          <span className="execution-meta-label">Files</span>
                          <span className="execution-meta-val">
                            {execution.generated_code?.files?.length || 0}
                          </span>
                        </div>
                        <div className="execution-meta-item execution-meta-full">
                          <span className="execution-meta-label">Created</span>
                          <span className="execution-meta-val">
                            {execution.created_at
                              ? new Date(execution.created_at).toLocaleString()
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )

          }

        </div>

      </div>

    </DashboardLayout>

  );

}

export default Executions;