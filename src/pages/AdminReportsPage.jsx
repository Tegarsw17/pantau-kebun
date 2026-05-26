import { AdminModulePlaceholderPage } from "./AdminModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminReportsPage() {
  return <AdminModulePlaceholderPage module={WORKSPACE_MODULES.reports} />;
}
