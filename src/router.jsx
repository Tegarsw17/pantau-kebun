import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AdminOrchardRoute } from "./components/AdminOrchardRoute.jsx";
import { WorkspaceLayout } from "./components/WorkspaceLayout.jsx";
import { WORKSPACE_MODULES } from "./data/workspaceModules.js";
import { ModulePlaceholderPage } from "./pages/ModulePlaceholderPage.jsx";
import { MonitoringPage } from "./pages/MonitoringPage.jsx";

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
  component: MonitoringPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "reports",
  component: () => <ModulePlaceholderPage module={WORKSPACE_MODULES.reports} />,
});

const inventoryRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "inventory",
  component: () => <ModulePlaceholderPage module={WORKSPACE_MODULES.inventory} />,
});

const operationsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "operations",
  component: () => <ModulePlaceholderPage module={WORKSPACE_MODULES.operations} />,
});

const accountingRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "accounting",
  component: () => <ModulePlaceholderPage module={WORKSPACE_MODULES.accounting} />,
});

const settingsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "settings",
  component: () => <ModulePlaceholderPage module={WORKSPACE_MODULES.settings} />,
});

const adminOrchardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-orchard",
  component: AdminOrchardRoute,
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
