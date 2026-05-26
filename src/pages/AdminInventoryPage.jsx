import { AdminModulePlaceholderPage } from "./AdminModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminInventoryPage() {
  return <AdminModulePlaceholderPage module={WORKSPACE_MODULES.inventory} />;
}
