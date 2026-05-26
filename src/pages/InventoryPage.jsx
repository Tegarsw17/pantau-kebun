import { InventoryWorkspace } from "../components/InventoryWorkspace.jsx";
import { WorkspacePageFrame } from "../components/WorkspacePageFrame.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function InventoryPage() {
  return (
    <WorkspacePageFrame module={WORKSPACE_MODULES.inventory} title="Inventory">
      <InventoryWorkspace userRole="non-admin" />
    </WorkspacePageFrame>
  );
}
