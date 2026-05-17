import { useDeferredValue, useEffect, useState } from "react";
import { MonitoringMapStage } from "../components/MonitoringMapStage.jsx";
import { TreeHistoryDrawer } from "../components/TreeHistoryDrawer.jsx";
import { WorkspacePageFrame } from "../components/WorkspacePageFrame.jsx";
import { WORKSPACE_MODULES } from "../data/workspaceModules.js";
import { loadMonitoringMapSnapshot } from "../data/loadMonitoringMapSnapshot.js";

const ALL_VALUES = "Tampilkan Semua";
const CATEGORY_OPTIONS = {
  plantType: {
    label: "Jenis Tumbuhan",
  },
  condition: {
    label: "Kondisi",
  },
};

export function MonitoringPage() {
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
    <WorkspacePageFrame module={WORKSPACE_MODULES.monitoring}>
      <main className="dashboard">
        <MonitoringMapStage
          allValues={ALL_VALUES}
          availableValues={availableValues}
          categoryOptions={CATEGORY_OPTIONS}
          gardenName={WORKSPACE_MODULES.monitoring.title}
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

        <section
          className="report-section workspace-panel workspace-panel--secondary"
          aria-label="Global Report Table"
        >
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
                        className={
                          selectedTreeId === row.plantId
                            ? "report-row report-row--selected"
                            : "report-row"
                        }
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

      {selectedTreeId !== null ? (
        <TreeHistoryDrawer
          historyEntries={selectedTreeHistory}
          latestHistoryEntry={latestHistoryEntry}
          onClose={() => setSelectedTreeId(null)}
          reportRow={selectedReportRow}
          selectedTree={selectedTree}
        />
      ) : null}
    </WorkspacePageFrame>
  );
}
