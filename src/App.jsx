import { useDeferredValue, useEffect, useState } from "react";
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
const SIDEBAR_NAV_GROUPS = [
  {
    label: "Core",
    items: [
      {
        isActive: true,
        label: "Monitoring",
      },
      {
        label: "Reports",
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        label: "Inventory",
      },
      {
        label: "Operations",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "Accounting",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Settings",
      },
    ],
  },
];

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

function MonitoringSidebar() {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <p className="eyebrow">Pantau Kebun</p>
        <strong className="app-sidebar__title">Farm Workspace</strong>
      </div>

      <nav className="app-sidebar__nav">
        {SIDEBAR_NAV_GROUPS.map((group) => (
          <section className="app-sidebar__group" key={group.label}>
            <p className="app-sidebar__group-label">{group.label}</p>

            <div className="app-sidebar__group-items">
              {group.items.map((item) => (
                <button
                  aria-current={item.isActive ? "page" : undefined}
                  aria-disabled={!item.isActive}
                  className={`app-sidebar__nav-button ${
                    item.isActive ? "app-sidebar__nav-button--active" : ""
                  }`}
                  key={item.label}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__status-card">
          <span className="app-sidebar__status-label">Active Scope</span>
          <strong>{MONITORING_GARDEN_NAME}</strong>
          <span>Garden 3</span>
        </div>
        <a className="app-sidebar__admin-link" href={ADMIN_ORCHARD_PATH}>
          Admin Orchard
        </a>
      </div>
    </aside>
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

  return (
    <div className="app-shell">
      <MonitoringSidebar />

      <div className="app-content">
        <section className="page-intro" aria-label="Monitoring page title">
          <p className="section-kicker">Monitoring</p>
          <div className="page-intro__copy">
            <h1>{MONITORING_GARDEN_NAME}</h1>
            <p className="page-intro__summary">Daily orchard monitoring workspace.</p>
          </div>
        </section>

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

          <section className="report-section" aria-label="Global Report Table">
            <div className="report-section__header">
              <div>
                <p className="section-kicker">Global Report</p>
                <h2>Operational record surface</h2>
              </div>

              <div className="report-toolbar">
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
          </section>
        </main>
      </div>

      {selectedTreeId !== null ? (
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
