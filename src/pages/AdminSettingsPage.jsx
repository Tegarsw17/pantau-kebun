import { AdminModulePlaceholderPage } from "./AdminModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminSettingsPage() {
  return <AdminModulePlaceholderPage module={WORKSPACE_MODULES.settings} />;
}
