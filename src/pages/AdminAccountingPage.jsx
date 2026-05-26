import { AdminModulePlaceholderPage } from "./AdminModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminAccountingPage() {
  return <AdminModulePlaceholderPage module={WORKSPACE_MODULES.accounting} />;
}
