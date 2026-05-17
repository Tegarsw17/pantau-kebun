import { Outlet } from "@tanstack/react-router";
import { WorkspaceSidebar } from "./WorkspaceSidebar.jsx";

export function WorkspaceLayout() {
  return (
    <div className="app-shell">
      <WorkspaceSidebar />

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
