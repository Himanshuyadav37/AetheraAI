import {
  useEffect,
  useState
} from "react";

import {
  useParams,
  Link
} from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import FileViewer from "../components/FileViewer";

import {
  getExecution
} from "../services/projectService";

import api from "../services/api";

import "./ProjectDetails.css";

function ProjectDetails() {

  const { id } = useParams();

  const [project, setProject] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [versions, setVersions] = useState([]);
  const [diffs, setDiffs] = useState([]);

  const loadProject = async () => {

    try {

      setLoading(true);

      console.log(
        "Loading Project ID:",
        id
      );

      const data =
        await getExecution(id);

      console.log(
        "Project Response:",
        data
      );

      if (!data) {

        setError(
          "Project not found"
        );

        return;
      }

      setProject(data);

      if (data.project_id) {
        const versionsRes = await api.get(
          `/ai/projects/${data.project_id}/versions`
        );
        setVersions(versionsRes.data || []);
      }

      const hasFixed = data.fixed_code?.files?.length > 0;
      const hasGenerated = data.generated_code?.files?.length > 0;
      if (hasFixed && hasGenerated) {
        const diffRes = await api.get(
          `/ai/executions/${id}/diff?compare=fixed`
        );
        setDiffs(diffRes.data || []);
      }

    }

    catch (err) {

      console.error(
        "Project Error:",
        err
      );

      setError(
        "Failed to load project"
      );

    }

    finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    void loadProject();

  }, [id]);

  useEffect(() => {

    if (project) {

      console.log(
        "FULL PROJECT:",
        project
      );

      console.log(
        "PROJECT PLAN:",
        project.project_plan
      );

      console.log(
        "GENERATED CODE:",
        project.generated_code
      );

      console.log(
        "FIXED CODE:",
        project.fixed_code
      );

      console.log(
        "AGENT NOTES:",
        project.agent_notes
      );

      console.log(
        "DEPLOYMENT PLAN:",
        project.deployment_plan
      );

      console.log(
        "GENERATED FILE COUNT:",
        project.generated_code?.files?.length
      );

      console.log(
        "FIXED FILE COUNT:",
        project.fixed_code?.files?.length
      );

    }

  }, [project]);

  if (loading) {

    return (

      <DashboardLayout>

        <div className="loading-state">

          Loading Project...

        </div>

      </DashboardLayout>

    );

  }

  if (error) {

    return (

      <DashboardLayout>

        <div className="error-state">

          {error}

        </div>

      </DashboardLayout>

    );

  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="error-state">
          Project Not Found
        </div>
      </DashboardLayout>
    );
  }

  const files =
    project.fixed_code?.files?.length > 0
      ? project.fixed_code.files
      : project.generated_code?.files?.length > 0
        ? project.generated_code.files
        : [];

  return (

    <DashboardLayout>

      <div className="project-details">

        <div className="project-header">

          <div>

            <h1>

              {
                project.project_plan
                  ?.project_name ||

                "Project Details"
              }

            </h1>

            <p>

              {
                project.idea ||

                "No description available"
              }

            </p>

          </div>

          <a

            href={`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/projects/${project.project_id}/download`}

            target="_blank"

            rel="noreferrer"

            className="download-btn"

          >

            ⬇ Download ZIP

          </a>

          <Link
            to={`/workspace?projectId=${project.project_id}&executionId=${project._id}`}
            className="download-btn"
            style={{ marginLeft: "12px" }}
          >
            ▶ Continue Development
          </Link>

        </div>

        <div className="stats-grid">

          <div className="stat-box">

            <span>Status</span>

            <h3>

              {
                project.status ||

                "Unknown"
              }

            </h3>

          </div>

          <div className="stat-box">

            <span>Iterations</span>

            <h3>

              {
                project.iterations ||

                0
              }

            </h3>

          </div>

          <div className="stat-box">

            <span>Project ID</span>

            <h3>

              {
                project.project_id ||

                project._id
              }

            </h3>

          </div>

        </div>

        <div className="card">

          <h2>

            Project Overview

          </h2>

          <p>

            {
              project.project_plan
                ?.project_description ||

              "No overview available"
            }

          </p>

        </div>

        {

          versions.length > 0 && (

            <div className="card">

              <h2>Version History</h2>

              {versions.map(v => (
                <div key={v._id} className="timeline-item">
                  v{v.version} — {v.idea?.slice(0, 80)}
                  {v.created_at && (
                    <small> ({new Date(v.created_at).toLocaleString()})</small>
                  )}
                </div>
              ))}

            </div>

          )

        }

        {

          project.agent_notes?.length > 0 && (

            <div className="card">

              <h2>

                Agent Timeline

              </h2>

              {

                project.agent_notes.map(

                  (
                    note,
                    index
                  ) => (

                    <div

                      key={index}

                      className="timeline-item"

                    >

                      ✅ {note}

                    </div>

                  )

                )

              }

            </div>

          )

        }

        {

          project.execution_steps?.length > 0 && (

            <div className="card">

              <h2>

                Execution Timeline

              </h2>

              <div
                style={{
                  background: "#1e293b",
                  borderRadius: "8px",
                  padding: "20px",
                  maxHeight: "500px",
                  overflowY: "auto"
                }}
              >

                {
                  (project.execution_steps || [])
  .filter(step => step)
  .map(
                    (step, index) => (
                      <div
                        key={index}
                        style={{
                          marginBottom: "12px",
                          paddingBottom: "12px",
                          borderBottom: "1px solid #334155",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px"
                        }}
                      >

                        <div
                          style={{
                            minWidth: "80px",
                            fontSize: "12px",
                            color: "#94a3b8",
                            paddingTop: "2px"
                          }}
                        >
                          {
  step?.timestamp
    ? new Date(step.timestamp).toLocaleTimeString()
    : "--"
}
                        </div>

                        <div
                          style={{
                            flex: 1
                          }}
                        >

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "4px"
                            }}
                          >

                            <span
                              style={{
                                background: step.status === "completed"
                                  ? "#10b981"
                                  : step.status === "failed"
                                    ? "#ef4444"
                                    : "#3b82f6",
                                color: "white",
                                fontSize: "10px",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                textTransform: "uppercase",
                                fontWeight: "bold"
                              }}
                            >
                              {step.agent}
                            </span>

                            <span
                              style={{
                                color: "#e2e8f0",
                                fontSize: "14px",
                                fontWeight: "500"
                              }}
                            >
                              {step.message}
                            </span>

                          </div>

                          {
                            step.details && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#94a3b8",
                                  marginTop: "4px"
                                }}
                              >
                                {Object.entries(step.details).map(
                                  ([key, value]) => (
                                    <span
                                      key={key}
                                      style={{
                                        marginRight: "16px"
                                      }}
                                    >
                                      {key}: {Array.isArray(value) ? value.join(", ") : value}
                                    </span>
                                  )
                                )}
                              </div>
                            )
                          }

                        </div>

                      </div>
                    )
                  )
                }

              </div>

            </div>

          )

        }

        {

          project.debug_report && (

            <div className="card">

              <h2>

                Debug Report

              </h2>

              <pre className="debug-report">

                {
                  project.debug_report
                }

              </pre>

            </div>

          )

        }

        {

          project.deployment_plan && (

            <div className="card">

              <h2>

                Deployment Plan

              </h2>

              <pre className="debug-report">

                {

                  JSON.stringify(

                    project.deployment_plan,

                    null,

                    2

                  )

                }

              </pre>

            </div>

          )

        }

        {
  files.length > 0 ? (

    <div className="card">

      <h2>
        Generated Files
      </h2>

      <FileViewer
        files={
          Array.isArray(files)
            ? files
            : []
        }
        diffs={diffs}
        showDiffToggle={diffs.length > 0}
        executionId={id}
        onFileSave={loadProject}
      />

    </div>

  ) : (

    <div className="card">

      <h2>
        Generated Files
      </h2>

      <p>
        No generated files found.
      </p>

    </div>

  )
}
      </div>

    </DashboardLayout>

  );

}

export default ProjectDetails;