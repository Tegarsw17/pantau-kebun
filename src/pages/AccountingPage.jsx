import { ModulePlaceholderPage } from "./ModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AccountingPage() {
  return <ModulePlaceholderPage module={WORKSPACE_MODULES.accounting} />;
}
