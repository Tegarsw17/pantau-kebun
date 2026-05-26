import { AdminPageFrame } from "../components/AdminPageFrame.jsx";
import { InventoryWorkspace } from "../components/InventoryWorkspace.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";

export function AdminInventoryPage() {
  return (
    <AdminPageFrame
      summary="Admin stock control for supplies, inputs, expiry tracking, and inventory ledger mutations."
      title={WORKSPACE_MODULES.inventory.label}
    >
      <InventoryWorkspace userRole="admin" />
    </AdminPageFrame>
  );
}
