import { useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import EducationChat from "../components/workspace/EducationChat";
import { useWorkspace } from "../contexts/WorkspaceContext";

export default function Education() {
  const { activeModule, switchModule } = useWorkspace();

  useEffect(() => {
    if (activeModule !== "education") {
      switchModule("education");
    }
  }, [activeModule, switchModule]);

  return (
    <DashboardLayout>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#212121" }}>
        <EducationChat />
      </div>
    </DashboardLayout>
  );
}