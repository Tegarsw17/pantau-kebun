import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { WorkspaceLayout } from "./components/WorkspaceLayout.jsx";

function RootRouteComponent() {
  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: RootRouteComponent,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "workspace",
  component: WorkspaceLayout,
});

const adminWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "adminWorkspace",
  component: lazyRouteComponent(
    () => import("./components/AdminOrchardRoute.jsx"),
    "AdminOrchardRoute",
  ),
});

const monitoringRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/MonitoringPage.jsx"), "MonitoringPage"),
});

const reportsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "reports",
  component: lazyRouteComponent(() => import("./pages/ReportsPage.jsx"), "ReportsPage"),
});

const inventoryRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "inventory",
  component: lazyRouteComponent(() => import("./pages/InventoryPage.jsx"), "InventoryPage"),
});

const operationsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "operations",
  component: lazyRouteComponent(() => import("./pages/OperationsPage.jsx"), "OperationsPage"),
});

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
  component: lazyRouteComponent(() => import("./pages/AccountingPage.jsx"), "AccountingPage"),
});

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings",
  component: lazyRouteComponent(() => import("./pages/SettingsPage.jsx"), "SettingsPage"),
});

const adminOrchardRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard",
  component: lazyRouteComponent(
    () => import("./pages/AdminOrchardPage.jsx"),
    "AdminOrchardPage",
  ),
});

const adminReportsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard/reports",
  component: lazyRouteComponent(() => import("./pages/AdminReportsPage.jsx"), "AdminReportsPage"),
});

const adminInventoryRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard/inventory",
  component: lazyRouteComponent(
    () => import("./pages/AdminInventoryPage.jsx"),
    "AdminInventoryPage",
  ),
});

const adminOperationsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard/operations",
  component: lazyRouteComponent(
    () => import("./pages/AdminOperationsPage.jsx"),
    "AdminOperationsPage",
  ),
});

const adminAccountingRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard/accounting",
  component: lazyRouteComponent(
    () => import("./pages/AdminAccountingPage.jsx"),
    "AdminAccountingPage",
  ),
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: "admin-orchard/settings",
  component: lazyRouteComponent(() => import("./pages/AdminSettingsPage.jsx"), "AdminSettingsPage"),
});

const routeTree = rootRoute.addChildren([
  workspaceRoute.addChildren([
    monitoringRoute,
    reportsRoute,
    inventoryRoute,
    operationsRoute,
    accountingRoute,
    settingsRoute,
  ]),
  adminWorkspaceRoute.addChildren([
    adminOrchardRoute,
    adminReportsRoute,
    adminInventoryRoute,
    adminOperationsRoute,
    adminAccountingRoute,
    adminSettingsRoute,
  ]),
]);

export const router = createRouter({
  defaultPreload: "intent",
  routeTree,
});
