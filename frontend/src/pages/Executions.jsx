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
              NexusAI
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

              <div
                className="execution-table"
              >

                <table>

                  <thead>

                    <tr>

                      <th>
                        Project
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Iterations
                      </th>

                      <th>
                        Files
                      </th>

                      <th>
                        Created
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {

                      executions.map(
                        (
                          execution
                        ) => (

                          <tr
                            key={
                              execution._id
                            }
                          >

                            <td>

                              {

                                execution
                                  .project_plan
                                  ?.project_name ||

                                execution
                                  .idea ||

                                "Untitled"

                              }

                            </td>

                            <td>

                              <span
                                className={
                                  execution.status ===
                                  "completed"

                                    ? "badge success"

                                    : "badge danger"
                                }
                              >

                                {
                                  execution.status
                                }

                              </span>

                            </td>

                            <td>

                              {

                                execution.iterations ||
                                0

                              }

                            </td>

                            <td>

                              {

                                execution
                                  .generated_code
                                  ?.files
                                  ?.length ||

                                0

                              }

                            </td>

                            <td>

                              {

                                execution.created_at

                                  ?

                                  new Date(
                                    execution.created_at
                                  )
                                    .toLocaleString()

                                  :

                                  "-"

                              }

                            </td>

                          </tr>

                        )
                      )

                    }

                  </tbody>

                </table>

              </div>

            )

          }

        </div>

      </div>

    </DashboardLayout>

  );

}

export default Executions;