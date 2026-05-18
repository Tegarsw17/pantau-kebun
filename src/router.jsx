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
  getParentRoute: () => rootRoute,
  path: "admin-orchard",
  component: lazyRouteComponent(
    () => import("./components/AdminOrchardRoute.jsx"),
    "AdminOrchardRoute",
  ),
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
  adminOrchardRoute,
]);

export const router = createRouter({
  defaultPreload: "intent",
  routeTree,
});
