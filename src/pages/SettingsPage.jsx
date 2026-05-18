import { ModulePlaceholderPage } from "./ModulePlaceholderPage.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function SettingsPage() {
  return <ModulePlaceholderPage module={WORKSPACE_MODULES.settings} />;
}
