import { useDeferredValue, useEffect, useState } from "react";
import { loadMonitoringMapSnapshot } from "./data/loadMonitoringMapSnapshot.js";

const ALL_VALUES = "Tampilkan Semua";
const CATEGORY_OPTIONS = {
  plantType: {
    label: "Jenis Tumbuhan",
  },
  condition: {
    label: "Kondisi",
  },
};

function App() {
  const [mapSnapshot, setMapSnapshot] = useState({
    loadState: "loading",
    dots: [],
    totalTrees: 0,
    filters: {
      plantType: [],
      condition: [],
    },
    reportRows: [],
    message: "Loading synthetic coordinate layout",
  });
  const [selectedCategory, setSelectedCategory] = useState("condition");
  const [selectedValue, setSelectedValue] = useState(ALL_VALUES);
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
          totalTrees: snapshot.totalTrees,
          filters: snapshot.filters,
          reportRows: snapshot.reportRows,
          message: "Synthetic layout loaded from JSON",
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setMapSnapshot({
          loadState: "error",
          dots: [],
          totalTrees: 0,
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

  const activeCategory = CATEGORY_OPTIONS[selectedCategory];
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
      <header className="topbar">
        <div>
          <p className="eyebrow">Pantau Kebun</p>
          <h1>Main Monitoring Dashboard</h1>
        </div>
        <div className="topbar-meta">
          <div className="sync-pill">
            <span className="sync-dot" />
            <span>Ready for Garden 3</span>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="filter-band" aria-label="Monitoring Filters">
          <div className="filter-band__header">
            <div>
              <p className="section-kicker">Cascading Filters</p>
              <h2>Visual category controls</h2>
            </div>
            <p className="filter-summary">
              {activeCategory.label} / {selectedValue}
            </p>
          </div>

          <div className="filter-grid">
            <label className="control-block">
              <span className="control-label">Kategori</span>
              <select
                aria-label="Kategori"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                disabled={mapSnapshot.loadState !== "ready"}
              >
                {Object.entries(CATEGORY_OPTIONS).map(([key, option]) => (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-block">
              <span className="control-label">Nilai</span>
              <select
                aria-label="Nilai"
                value={selectedValue}
                onChange={(event) => setSelectedValue(event.target.value)}
                disabled={mapSnapshot.loadState !== "ready"}
              >
                <option value={ALL_VALUES}>{ALL_VALUES}</option>
                {availableValues.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="active-context">
              <span className="context-label">Monitoring Context</span>
              <div className="context-values">
                <span className="context-chip">Garden 3</span>
                <span className="context-chip">Orthomosaic Ready</span>
                <span className="context-chip">
                  {visibleDots.length}/{mapSnapshot.totalTrees} Visible
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="map-stage" aria-label="Orchard Map">
          <div className="map-stage__header">
            <div>
              <p className="section-kicker">Spatial Canvas</p>
              <h2>Orchard command view</h2>
            </div>

            <div className="legend-cluster" aria-label="Legend Preview">
              {legendItems.map((item) => (
                <span
                  className={`legend-chip ${
                    selectedValue === ALL_VALUES
                      ? ""
                      : selectedValue === item.value
                        ? "legend-chip--active"
                        : "legend-chip--muted"
                  }`}
                  key={item.value}
                >
                  <span className={`legend-swatch ${item.legendClassName}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="map-viewport">
            <div className="map-viewport__artboard" aria-hidden="true">
              <img
                className="map-viewport__image"
                src="/dronentak.jpeg"
                alt="Drone orthomosaic preview for Garden 3"
              />
              <div className="map-viewport__scrim" />
              <div className="map-viewport__grid" />

              <div className="map-dot-layer">
                {visibleDots.map((dot) => {
                  const presentation = dot[selectedCategory];

                  return (
                    <span
                      className={`map-dot ${presentation.dotClassName}`}
                      key={dot.id}
                      style={{ left: `${dot.leftPercent}%`, top: `${dot.topPercent}%` }}
                      title={`${dot.treeIdDisplay} · ${dot.plantName} · ${dot.plantType.label} · ${dot.condition.label}`}
                    />
                  );
                })}

                <div className="map-overlay map-overlay--center">
                  <div className="focus-ring" />
                </div>
              </div>
            </div>

            <div className="map-overlay map-overlay--top-left">
              <p className="overlay-label">Map Status</p>
              <strong>
                {mapSnapshot.loadState === "ready" ? "JSON map preview ready" : "Map shell active"}
              </strong>
              <span>
                {selectedCategory === "plantType"
                  ? "Color mode: Jenis Tumbuhan"
                  : "Color mode: Kondisi"}
              </span>
            </div>

            <div className="map-overlay map-overlay--bottom-right">
              <p className="overlay-label">Visible Dots</p>
              <strong>{visibleDots.length} Trees</strong>
              <span>{mapSnapshot.message}</span>
            </div>
          </div>
        </section>

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
                    <tr key={row.treeId}>
                      <td className="mono">{row.treeId}</td>
                      <td>{row.plantName}</td>
                      <td>{row.jenis}</td>
                      <td>
                        <span className={`status-badge ${row.badgeClass}`}>● {row.kondisi}</span>
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
  );
}

export default App;
