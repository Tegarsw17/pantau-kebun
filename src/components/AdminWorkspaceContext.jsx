import { createContext, useContext } from "react";

const AdminWorkspaceContext = createContext({
  gardenLabel: "Kebun Ntak-Ntak",
  onLockSession() {},
});

export function AdminWorkspaceProvider({ children, value }) {
  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>;
}

export function useAdminWorkspace() {
  return useContext(AdminWorkspaceContext);
}
