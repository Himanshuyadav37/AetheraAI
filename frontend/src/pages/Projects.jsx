import {
  useEffect,
  useState
} from "react";

import {
  Trash2
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import { useWorkspace } from "../contexts/WorkspaceContext";
import api from "../services/api";

import "./Projects.css";

function Projects() {

  const [
    projects,
    setProjects
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  const { activeModule, switchModule } = useWorkspace();

  async function loadProjects() {

    try {

      setLoading(true);

      const response =
        await api.get(
          "/ai/executions"
        );

      setProjects(
        response.data || []
      );

    }

    catch (err) {

      console.error(err);

      setError(
        "Failed to load projects"
      );

    }

    finally {

      setLoading(false);

    }

  }

  useEffect(() => {
    if (activeModule !== "engineer") {
      switchModule("engineer");
    }
    void loadProjects();
  }, [activeModule, switchModule]);

  async function deleteProject(id) {

    const confirmDelete =
      window.confirm(
        "Are you sure you want to delete this project?"
      );

    if (!confirmDelete) return;

    try {

      await api.delete(
        `/ai/executions/${id}`
      );

      setProjects(prev =>
        prev.filter(
          project =>
            project._id !== id
        )
      );

    }

    catch (error) {

      console.error(error);

      alert(
        "Failed to delete project."
      );

    }

  }

  return (

    <DashboardLayout>

      <div className="projects-page">

      <div className="page-header">

        <h1>

          Generated Projects

        </h1>

        <p>

          Browse all AI generated projects

        </p>

      </div>

      {

        loading ? (

          <div className="page-state">

            Loading Projects...

          </div>

        ) : error ? (

          <div className="page-state error">

            {error}

          </div>

        ) : projects.length === 0 ? (

          <div className="page-state">

            No Projects Found

          </div>

        ) : (

          <div className="projects-grid">

            {

              projects.map(project => (

                <div
                  key={project._id}
                  className="project-card"
                >

                  {/* Delete Button */}

                  <button

                    className="delete-project-btn"

                    onClick={(e) => {

                      e.preventDefault();

                      e.stopPropagation();

                      deleteProject(
                        project._id
                      );

                    }}

                  >

                    <Trash2
                      size={16}
                    />

                  </button>

                  <Link

                    to={`/projects/${project._id}`}

                    className="project-card-link"

                  >

                    <h3>

                      {

                        project.project_plan
                          ?.project_name ||

                        project.idea ||

                        "Untitled Project"

                      }

                    </h3>

                    <p>

                      Status: {

                        project.status ||

                        "completed"

                      }

                    </p>

                    <div
                      className="project-meta"
                    >

                      <span>

                        Iterations: {

                          project.iterations ||

                          0

                        }

                      </span>

                    </div>

                    <small>

                      {

                        project.created_at

                          ?

                          new Date(
                            project.created_at
                          ).toLocaleString()

                          :

                          ""

                      }

                    </small>

                  </Link>

                  <Link

                    to={`/workspace?projectId=${project.project_id}&executionId=${project._id}`}

                    className="continue-link"

                  >

                    Continue →

                  </Link>

                </div>

              ))

            }

          </div>

        )

      }

      </div>

    </DashboardLayout>

  );

}

export default Projects;