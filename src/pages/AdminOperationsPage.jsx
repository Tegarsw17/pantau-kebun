import { AdminModulePlaceholderPage } from "./AdminModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminOperationsPage() {
  return <AdminModulePlaceholderPage module={WORKSPACE_MODULES.operations} />;
}
