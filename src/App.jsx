import { useDeferredValue, useEffect, useState } from "react";
import {
  FileText,
  Map,
  Package,
  Settings2,
  Wallet,
  Wrench,
} from "lucide-react";
import { AdminOrchardRoute } from "./components/AdminOrchardRoute.jsx";
import { MonitoringMapStage } from "./components/MonitoringMapStage.jsx";
import { TreeHistoryDrawer } from "./components/TreeHistoryDrawer.jsx";
import {
  loadMonitoringMapSnapshot,
  MONITORING_GARDEN_NAME,
} from "./data/loadMonitoringMapSnapshot.js";

const ADMIN_ORCHARD_PATH = "/admin-orchard";
const ALL_VALUES = "Tampilkan Semua";
const CATEGORY_OPTIONS = {
  plantType: {
    label: "Jenis Tumbuhan",
  },
  condition: {
    label: "Kondisi",
  },
};
const DEFAULT_MODULE_ID = "monitoring";
const MODULE_DEFINITIONS = {
  accounting: {
    id: "accounting",
    icon: Wallet,
    label: "Accounting",
    moduleCode: "AC",
    navHint: "Cash flow, budget, and orchard finance controls.",
    placeholderCopy:
      "Financial control surfaces will sit here once orchard expenses, revenue, and budget flows are connected.",
    plannedCapabilities: [
      {
        description: "Track orchard spending, vendor payments, and recurring field costs.",
        title: "Expense Journal",
      },
      {
        description: "Review harvest income, settlement status, and invoice checkpoints.",
        title: "Revenue Tracking",
      },
      {
        description: "Compare plan versus realization across gardens and operational periods.",
        title: "Budget Control",
      },
    ],
    surfaceCount: 3,
    status: "soon",
    summary: "Financial controls for orchard operations and business reporting.",
    title: "Accounting",
  },
  inventory: {
    id: "inventory",
    icon: Package,
    label: "Inventory",
    moduleCode: "IV",
    navHint: "Stock, field inputs, and storage movement.",
    placeholderCopy:
      "Stock movement for fertilizer, chemicals, harvest supplies, and storage lots will be managed from this module.",
    plannedCapabilities: [
      {
        description: "Maintain incoming and outgoing stock across orchard supply categories.",
        title: "Stock Ledger",
      },
      {
        description: "Track storage positions, unit counts, and depletion over time.",
        title: "Warehouse View",
      },
      {
        description: "Alert when critical field inputs fall below operational thresholds.",
        title: "Reorder Signals",
      },
    ],
    surfaceCount: 3,
    status: "soon",
    summary: "Supply, input, and stock-control workspace for farm operations.",
    title: "Inventory",
  },
  monitoring: {
    id: "monitoring",
    icon: Map,
    label: "Monitoring",
    moduleCode: "MO",
    navHint: "Spatial map, field signals, and update review.",
    surfaceCount: 4,
    status: "live",
    summary: "Daily orchard monitoring workspace.",
    title: MONITORING_GARDEN_NAME,
  },
  operations: {
    id: "operations",
    icon: Wrench,
    label: "Operations",
    moduleCode: "OP",
    navHint: "Tasks, crews, and routine execution planning.",
    placeholderCopy:
      "Field execution workflows will live here once daily tasks, crews, and maintenance programs are connected.",
    plannedCapabilities: [
      {
        description: "Assign, track, and verify orchard work by area and responsible team.",
        title: "Task Board",
      },
      {
        description: "Monitor recurring maintenance such as pruning, spraying, and irrigation checks.",
        title: "Routine Schedule",
      },
      {
        description: "Capture field blockers, delays, and handoff notes for operations leads.",
        title: "Execution Notes",
      },
    ],
    surfaceCount: 3,
    status: "soon",
    summary: "Task, workforce, and field execution workspace for daily operations.",
    title: "Operations",
  },
  reports: {
    id: "reports",
    icon: FileText,
    label: "Reports",
    moduleCode: "RP",
    navHint: "Cross-period orchard review and reporting.",
    placeholderCopy:
      "Cross-period orchard reporting and review flows will be centralized here once export and comparison workflows are ready.",
    plannedCapabilities: [
      {
        description: "Review field updates, trends, and exportable summaries by reporting window.",
        title: "History Review",
      },
      {
        description: "Compare condition and progress snapshots across selected periods.",
        title: "Period Comparison",
      },
      {
        description: "Prepare scheduled summaries for owners, operators, and finance teams.",
        title: "Distribution Reports",
      },
    ],
    surfaceCount: 3,
    status: "soon",
    summary: "Historical review and reporting workspace for orchard performance.",
    title: "Reports",
  },
  settings: {
    id: "settings",
    icon: Settings2,
    label: "Settings",
    moduleCode: "ST",
    navHint: "Garden setup, access, and workspace defaults.",
    placeholderCopy:
      "System-level configuration will stay here once garden setup, access, and workspace preferences are exposed.",
    plannedCapabilities: [
      {
        description: "Maintain garden registry, naming standards, and shared workspace settings.",
        title: "Garden Setup",
      },
      {
        description: "Define user access, roles, and operational permissions across modules.",
        title: "Access Control",
      },
      {
        description: "Manage interface defaults, export rules, and system-level preferences.",
        title: "Workspace Preferences",
      },
    ],
    surfaceCount: 3,
    status: "soon",
    summary: "System configuration, access, and workspace settings.",
    title: "Settings",
  },
};
const SIDEBAR_NAV_ITEMS = ["monitoring", "reports", "inventory", "operations", "accounting", "settings"];

function normalizePathname(pathname) {
  if (!pathname) {
    return "/";
  }

  const normalizedPathname = pathname.replace(/\/+$/, "");
  return normalizedPathname === "" ? "/" : normalizedPathname;
}

function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));

  useEffect(() => {
    const syncPathname = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.addEventListener("popstate", syncPathname);

    return () => {
      window.removeEventListener("popstate", syncPathname);
    };
  }, []);

  return pathname;
}

function MonitoringSidebar({ onSelectModule, selectedModuleId }) {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-mark" aria-hidden="true">
          PK
        </div>
        <div className="app-sidebar__brand-copy">
          <p className="eyebrow">Pantau Kebun</p>
          <strong className="app-sidebar__title">Farm Workspace</strong>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {SIDEBAR_NAV_ITEMS.map((itemId) => {
          const item = MODULE_DEFINITIONS[itemId];
          const Icon = item.icon;
          const isActive = selectedModuleId === itemId;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={`app-sidebar__nav-button ${
                isActive ? "app-sidebar__nav-button--active" : ""
              }`}
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              type="button"
            >
              <span className="app-sidebar__nav-button-main">
                <span className="app-sidebar__nav-glyph" aria-hidden="true">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="app-sidebar__nav-button-label">{item.label}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function ModulePlaceholderPage({ module }) {
  return (
    <main className="dashboard">
      <section className="workspace-panel workspace-panel--secondary" aria-label={`${module.label} module status`}>
        <div className="workspace-panel__header">
          <div className="workspace-panel__heading">
            <p className="section-kicker">{module.label}</p>
            <h2>Coming soon</h2>
          </div>
        </div>

        <div className="workspace-panel__body">
          <p className="module-placeholder__copy">{module.placeholderCopy}</p>
        </div>
      </section>
    </main>
  );
}

function MonitoringDashboard() {
  const [mapSnapshot, setMapSnapshot] = useState({
    loadState: "loading",
    dots: [],
    imageCalibration: null,
    mapBounds: null,
    totalTrees: 0,
    treeHistoryByPlantId: {},
    filters: {
      plantType: [],
      condition: [],
    },
    reportRows: [],
    message: "Loading synthetic coordinate layout",
  });
  const [selectedCategory, setSelectedCategory] = useState("condition");
  const [selectedModuleId, setSelectedModuleId] = useState(DEFAULT_MODULE_ID);
  const [selectedValue, setSelectedValue] = useState(ALL_VALUES);
  const [selectedTreeId, setSelectedTreeId] = useState(null);
  const [tableSearchQuery, setTableSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadMonitoringMapSnapshot()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setMapSnapshot({
          loadState: "ready",
          dots: snapshot.dots,
          imageCalibration: snapshot.imageCalibration,
          mapBounds: snapshot.mapBounds,
          totalTrees: snapshot.totalTrees,
          treeHistoryByPlantId: snapshot.treeHistoryByPlantId ?? {},
          filters: snapshot.filters,
          reportRows: snapshot.reportRows,
          message: snapshot.message,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setMapSnapshot({
          loadState: "error",
          dots: [],
          imageCalibration: null,
          mapBounds: null,
          totalTrees: 0,
          treeHistoryByPlantId: {},
          filters: {
            plantType: [],
            condition: [],
          },
          reportRows: [],
          message: "Failed to load synthetic coordinate layout",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedValue(ALL_VALUES);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedTreeId === null) {
      return;
    }

    const hasSelectedTree = mapSnapshot.reportRows.some((row) => row.plantId === selectedTreeId);

    if (!hasSelectedTree) {
      setSelectedTreeId(null);
    }
  }, [mapSnapshot.reportRows, selectedTreeId]);

  useEffect(() => {
    if (selectedModuleId !== DEFAULT_MODULE_ID && selectedTreeId !== null) {
      setSelectedTreeId(null);
    }
  }, [selectedModuleId, selectedTreeId]);

  const availableValues = mapSnapshot.filters[selectedCategory] ?? [];
  const deferredTableSearchQuery = useDeferredValue(tableSearchQuery);
  const visibleDots =
    selectedValue === ALL_VALUES
      ? mapSnapshot.dots
      : mapSnapshot.dots.filter((dot) => dot[selectedCategory].value === selectedValue);

  const legendItems =
    selectedValue === ALL_VALUES
      ? availableValues
      : availableValues.filter((item) => item.value === selectedValue);
  const selectedTree = mapSnapshot.dots.find((dot) => String(dot.id) === selectedTreeId) ?? null;
  const selectedReportRow =
    mapSnapshot.reportRows.find((row) => row.plantId === selectedTreeId) ?? null;
  const selectedTreeHistory =
    selectedTreeId !== null ? mapSnapshot.treeHistoryByPlantId[selectedTreeId] ?? [] : [];
  const latestHistoryEntry = selectedTreeHistory[0] ?? null;
  const normalizedTableSearchQuery = deferredTableSearchQuery.trim().toLowerCase();
  const filteredReportRows =
    normalizedTableSearchQuery === ""
      ? mapSnapshot.reportRows
      : mapSnapshot.reportRows.filter((row) => {
          const treeId = row.treeId.toLowerCase();
          const note = row.note.toLowerCase();

          return (
            treeId.includes(normalizedTableSearchQuery) || note.includes(normalizedTableSearchQuery)
          );
        });
  const activeModule = MODULE_DEFINITIONS[selectedModuleId] ?? MODULE_DEFINITIONS[DEFAULT_MODULE_ID];
  const isMonitoringModuleActive = selectedModuleId === DEFAULT_MODULE_ID;

  return (
    <div className="app-shell">
      <MonitoringSidebar
        onSelectModule={setSelectedModuleId}
        selectedModuleId={selectedModuleId}
      />

      <div className="app-content">
        <section className="page-intro" aria-label="Monitoring page title">
          <p className="section-kicker">{activeModule.label}</p>
          <div className="page-intro__copy">
            <h1>{activeModule.title}</h1>
            <p className="page-intro__summary">{activeModule.summary}</p>
          </div>
        </section>

        {isMonitoringModuleActive ? (
          <main className="dashboard">
            <MonitoringMapStage
              allValues={ALL_VALUES}
              availableValues={availableValues}
              categoryOptions={CATEGORY_OPTIONS}
              gardenName={MONITORING_GARDEN_NAME}
              imageCalibration={mapSnapshot.imageCalibration}
              imageBounds={mapSnapshot.mapBounds}
              legendItems={legendItems}
              loadState={mapSnapshot.loadState}
              mapMessage={mapSnapshot.message}
              onCategoryChange={setSelectedCategory}
              onSelectTree={setSelectedTreeId}
              onValueChange={setSelectedValue}
              selectedCategory={selectedCategory}
              selectedTree={selectedTree}
              selectedTreeId={selectedTreeId}
              selectedValue={selectedValue}
              visibleDots={visibleDots}
            />

            <section className="report-section workspace-panel workspace-panel--secondary" aria-label="Global Report Table">
              <div className="workspace-panel__header">
                <div className="workspace-panel__heading">
                  <p className="section-kicker">Global Report</p>
                  <h2>Operational record surface</h2>
                </div>

                <div className="workspace-panel__toolbar report-toolbar">
                  <label className="search-shell" aria-label="Search Placeholder">
                    <span className="search-shell__icon">⌕</span>
                    <input
                      type="text"
                      value={tableSearchQuery}
                      placeholder="Search Tree ID or notes"
                      onChange={(event) => setTableSearchQuery(event.target.value)}
                      disabled={mapSnapshot.loadState !== "ready"}
                    />
                  </label>
                  <span className="results-pill">{filteredReportRows.length} rows</span>
                </div>
              </div>

              <div className="workspace-panel__body">
                <div className="table-shell">
                  {filteredReportRows.length === 0 ? (
                    <div className="empty-table-state">
                      <strong>No matching records</strong>
                      <span>Try another Tree ID fragment or note keyword.</span>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Tree ID</th>
                          <th>Plant Name</th>
                          <th>Jenis</th>
                          <th>Kondisi</th>
                          <th>Last Note</th>
                          <th>Updated At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReportRows.map((row) => (
                          <tr
                            key={row.id ?? `${row.treeId}-${row.updatedAt}`}
                            className={selectedTreeId === row.plantId ? "report-row report-row--selected" : "report-row"}
                            onClick={() => setSelectedTreeId(row.plantId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedTreeId(row.plantId);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <td className="mono">{row.treeId}</td>
                            <td>{row.plantName}</td>
                            <td>{row.jenis}</td>
                            <td>
                              <span className="status-badge" style={row.badgeStyle}>
                                {row.conditionIcon ?? "●"} {row.kondisi}
                              </span>
                            </td>
                            <td>{row.note}</td>
                            <td>{row.updatedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          </main>
        ) : (
          <ModulePlaceholderPage module={activeModule} />
        )}
      </div>

      {isMonitoringModuleActive && selectedTreeId !== null ? (
        <TreeHistoryDrawer
          historyEntries={selectedTreeHistory}
          latestHistoryEntry={latestHistoryEntry}
          onClose={() => setSelectedTreeId(null)}
          reportRow={selectedReportRow}
          selectedTree={selectedTree}
        />
      ) : null}
    </div>
  );
}

function App() {
  const pathname = usePathname();

  if (pathname === ADMIN_ORCHARD_PATH) {
    return <AdminOrchardRoute />;
  }

  return <MonitoringDashboard />;
}

export default App;
