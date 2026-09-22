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

import api, {
  getBaseURL
} from "../services/api";

import "./ProjectDetails.css";


/*
|--------------------------------------------------------------------------
| Normalize generated/fixed code
|--------------------------------------------------------------------------
|
| Canonical backend format:
|
| [
|   {
|     path: "src/App.jsx",
|     code: "..."
|   }
| ]
|
| Legacy format:
|
| {
|   files: [...]
| }
|
*/

const normalizeFiles = (value) => {

  if (Array.isArray(value)) {

    return value.filter(
      (file) =>
        file &&
        typeof file === "object" &&
        typeof file.path === "string" &&
        file.path.trim() !== ""
    );

  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray(value.files)
  ) {

    return value.files.filter(
      (file) =>
        file &&
        typeof file === "object" &&
        typeof file.path === "string" &&
        file.path.trim() !== ""
    );

  }

  return [];

};


const getProjectFiles = (project) => {

  if (!project) {
    return [];
  }

  const fixedFiles =
    normalizeFiles(
      project.fixed_code
    );

  if (fixedFiles.length > 0) {
    return fixedFiles;
  }

  return normalizeFiles(
    project.generated_code
  );

};


function ProjectDetails() {

  const {
    id
  } = useParams();


  const [project, setProject] =
    useState(null);


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState("");


  const [versions, setVersions] =
    useState([]);


  const [diffs, setDiffs] =
    useState([]);


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


      /*
       * ------------------------------------------------------
       * Normalize files immediately for debugging.
       * ------------------------------------------------------
       */

      const normalizedGenerated =
        normalizeFiles(
          data.generated_code
        );


      const normalizedFixed =
        normalizeFiles(
          data.fixed_code
        );


      console.log(
        "Generated files:",
        normalizedGenerated
      );


      console.log(
        "Fixed files:",
        normalizedFixed
      );


      console.log(
        "Generated file count:",
        normalizedGenerated.length
      );


      console.log(
        "Fixed file count:",
        normalizedFixed.length
      );


      /*
       * ------------------------------------------------------
       * Version history
       * ------------------------------------------------------
       */

      if (data.project_id) {

        try {

          const versionsRes =
            await api.get(
              `/ai/projects/${data.project_id}/versions`
            );

          setVersions(
            versionsRes.data || []
          );

        } catch (versionError) {

          console.warn(
            "Version history unavailable:",
            versionError
          );

          setVersions([]);

        }

      }


      /*
       * ------------------------------------------------------
       * Diff
       * ------------------------------------------------------
       *
       * Use normalized arrays instead of:
       *
       * data.fixed_code.files
       *
       */

      const hasFixed =
        normalizedFixed.length > 0;


      const hasGenerated =
        normalizedGenerated.length > 0;


      if (
        hasFixed &&
        hasGenerated
      ) {

        try {

          const diffRes =
            await api.get(
              `/ai/executions/${id}/diff?compare=fixed`
            );

          setDiffs(
            diffRes.data || []
          );

        } catch (diffError) {

          console.warn(
            "Diff unavailable:",
            diffError
          );

          setDiffs([]);

        }

      } else {

        setDiffs([]);

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

    if (!project) {
      return;
    }


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


    const generatedFiles =
      normalizeFiles(
        project.generated_code
      );


    const fixedFiles =
      normalizeFiles(
        project.fixed_code
      );


    console.log(
      "GENERATED FILE COUNT:",
      generatedFiles.length
    );


    console.log(
      "FIXED FILE COUNT:",
      fixedFiles.length
    );


    console.log(
      "FINAL FILE COUNT:",
      Math.max(
        generatedFiles.length,
        fixedFiles.length
      )
    );

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


  /*
  |--------------------------------------------------------------------------
  | FINAL FILE LIST
  |--------------------------------------------------------------------------
  |
  | fixed_code is preferred because it represents the verified/debugged
  | version.
  |
  | generated_code is fallback for projects that passed without debugger.
  |
  */

  const files =
    getProjectFiles(
      project
    );


  console.log(
    "FINAL WORKSPACE FILES:",
    files
  );


  console.log(
    "FINAL WORKSPACE FILE COUNT:",
    files.length
  );


  return (

    <DashboardLayout>

      <div className="project-details">


        {/* ======================================================
            PROJECT HEADER
        ====================================================== */}

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
            href={
              `${getBaseURL()}/projects/${project.project_id}/download`
            }
            target="_blank"
            rel="noreferrer"
            className="download-btn"
          >

            ⬇ Download ZIP

          </a>


          <Link
            to={
              `/workspace?projectId=${project.project_id}&executionId=${project._id}`
            }
            className="download-btn"
            style={{
              marginLeft: "12px"
            }}
          >

            ▶ Continue Development

          </Link>

        </div>


        {/* ======================================================
            STATS
        ====================================================== */}

        <div className="stats-grid">


          <div className="stat-box">

            <span>
              Status
            </span>

            <h3>

              {
                project.status ||

                "Unknown"
              }

            </h3>

          </div>


          <div className="stat-box">

            <span>
              Iterations
            </span>

            <h3>

              {
                project.iterations ||

                0
              }

            </h3>

          </div>


          <div className="stat-box">

            <span>
              Project ID
            </span>

            <h3>

              {
                project.project_id ||

                project._id
              }

            </h3>

          </div>


        </div>


        {/* ======================================================
            PROJECT OVERVIEW
        ====================================================== */}

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


        {/* ======================================================
            VERSION HISTORY
        ====================================================== */}

        {

          versions.length > 0 && (

            <div className="card">

              <h2>
                Version History
              </h2>


              {

                versions.map(
                  (v) => (

                    <div
                      key={v._id}
                      className="timeline-item"
                    >

                      v{v.version} — {
                        v.idea?.slice(
                          0,
                          80
                        )
                      }


                      {

                        v.created_at && (

                          <small>

                            {" "}
                            (
                            {
                              new Date(
                                v.created_at
                              ).toLocaleString()
                            }
                            )

                          </small>

                        )

                      }

                    </div>

                  )
                )

              }

            </div>

          )

        }


        {/* ======================================================
            AGENT TIMELINE
        ====================================================== */}

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


        {/* ======================================================
            EXECUTION TIMELINE
        ====================================================== */}

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

                  (
                    project.execution_steps ||
                    []
                  )
                    .filter(
                      (step) => step
                    )
                    .map(
                      (
                        step,
                        index
                      ) => (

                        <div
                          key={index}
                          style={{
                            marginBottom: "12px",
                            paddingBottom: "12px",
                            borderBottom:
                              "1px solid #334155",
                            display: "flex",
                            alignItems:
                              "flex-start",
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
                                ? new Date(
                                    step.timestamp
                                  ).toLocaleTimeString()
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
                                alignItems:
                                  "center",
                                gap: "8px",
                                marginBottom: "4px"
                              }}
                            >

                              <span
                                style={{
                                  background:
                                    step.status ===
                                    "completed"
                                      ? "#10b981"
                                      : step.status ===
                                        "failed"
                                        ? "#ef4444"
                                        : "#3b82f6",
                                  color: "white",
                                  fontSize: "10px",
                                  padding:
                                    "2px 8px",
                                  borderRadius:
                                    "4px",
                                  textTransform:
                                    "uppercase",
                                  fontWeight:
                                    "bold"
                                }}
                              >

                                {
                                  step.agent
                                }

                              </span>


                              <span
                                style={{
                                  color: "#e2e8f0",
                                  fontSize: "14px",
                                  fontWeight:
                                    "500"
                                }}
                              >

                                {
                                  step.message
                                }

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

                                  {

                                    Object.entries(
                                      step.details
                                    ).map(
                                      (
                                        [
                                          key,
                                          value
                                        ]
                                      ) => (

                                        <span
                                          key={key}
                                          style={{
                                            marginRight:
                                              "16px"
                                          }}
                                        >

                                          {
                                            key
                                          }:{" "}

                                          {
                                            Array.isArray(
                                              value
                                            )
                                              ? value.join(
                                                  ", "
                                                )
                                              : String(
                                                  value
                                                )
                                          }

                                        </span>

                                      )
                                    )

                                  }

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


        {/* ======================================================
            DEBUG REPORT
        ====================================================== */}

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


        {/* ======================================================
            DEPLOYMENT PLAN
        ====================================================== */}

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


        {/* ======================================================
            GENERATED FILES / CODE VIEWER
        ====================================================== */}

        {

          files.length > 0 ? (

            <div className="card">

              <h2>

                Generated Files

                {" "}

                <span
                  style={{
                    fontSize: "13px",
                    opacity: 0.65,
                    fontWeight: "normal"
                  }}
                >
                  ({files.length})
                </span>

              </h2>


              <FileViewer
                files={
                  files
                }
                diffs={
                  diffs
                }
                showDiffToggle={
                  diffs.length > 0
                }
                executionId={
                  id
                }
                onFileSave={
                  loadProject
                }
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