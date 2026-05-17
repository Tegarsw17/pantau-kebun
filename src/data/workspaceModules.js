import {
  FileText,
  Map,
  Package,
  Settings2,
  Wallet,
  Wrench,
} from "lucide-react";
import { MONITORING_GARDEN_NAME } from "./loadMonitoringMapSnapshot.js";

export const WORKSPACE_MODULES = {
  accounting: {
    icon: Wallet,
    id: "accounting",
    label: "Accounting",
    placeholderCopy:
      "Financial control surfaces will sit here once orchard expenses, revenue, and budget flows are connected.",
    summary: "Financial controls for orchard operations and business reporting.",
    title: "Accounting",
    to: "/accounting",
  },
  inventory: {
    icon: Package,
    id: "inventory",
    label: "Inventory",
    placeholderCopy:
      "Stock movement for fertilizer, chemicals, harvest supplies, and storage lots will be managed from this module.",
    summary: "Supply, input, and stock-control workspace for farm operations.",
    title: "Inventory",
    to: "/inventory",
  },
  monitoring: {
    icon: Map,
    id: "monitoring",
    label: "Monitoring",
    summary: "Daily orchard monitoring workspace.",
    title: MONITORING_GARDEN_NAME,
    to: "/",
  },
  operations: {
    icon: Wrench,
    id: "operations",
    label: "Operations",
    placeholderCopy:
      "Field execution workflows will live here once daily tasks, crews, and maintenance programs are connected.",
    summary: "Task, workforce, and field execution workspace for daily operations.",
    title: "Operations",
    to: "/operations",
  },
  reports: {
    icon: FileText,
    id: "reports",
    label: "Reports",
    placeholderCopy:
      "Cross-period orchard reporting and review flows will be centralized here once export and comparison workflows are ready.",
    summary: "Historical review and reporting workspace for orchard performance.",
    title: "Reports",
    to: "/reports",
  },
  settings: {
    icon: Settings2,
    id: "settings",
    label: "Settings",
    placeholderCopy:
      "System-level configuration will stay here once garden setup, access, and workspace preferences are exposed.",
    summary: "System configuration, access, and workspace settings.",
    title: "Settings",
    to: "/settings",
  },
};

export const WORKSPACE_NAV_ITEMS = [
  "monitoring",
  "reports",
  "inventory",
  "operations",
  "accounting",
  "settings",
];
