import DashboardLayout from "../layouts/DashboardLayout";
import AutomationWorkspace from "../components/automation/AutomationWorkspace";

/**
 * AutomationWorkspacePage
 *
 * Page wrapper for the Automation AI module.
 * Mounted at /automation via App.jsx.
 */
function AutomationWorkspacePage() {
  return (
    <DashboardLayout>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <AutomationWorkspace />
      </div>
    </DashboardLayout>
  );
}

export default AutomationWorkspacePage;
