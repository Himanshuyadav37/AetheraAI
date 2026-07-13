import React from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import McpRegistry from "../components/workspace/McpRegistry";

function McpPage() {
  return (
    <DashboardLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
        <McpRegistry />
      </div>
    </DashboardLayout>
  );
}

export default McpPage;
