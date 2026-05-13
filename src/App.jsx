import { useEffect, useState } from "react";
import { loadMonitoringMapSnapshot } from "./data/loadMonitoringMapSnapshot.js";

const sampleRows = [
  {
    treeId: "G03-P000013",
    plantName: "Bawor 1",
    jenis: "Bawor",
    kondisi: "Baik",
    badgeClass: "status-badge--green",
    note: "Waiting for monitoring feed",
    updatedAt: "2026-02-14",
  },
  {
    treeId: "G03-P000023",
    plantName: "Musangking 1",
    jenis: "Musangking",
    kondisi: "Perlu Cek",
    badgeClass: "status-badge--amber",
    note: "Shell placeholder row",
    updatedAt: "2026-02-14",
  },
  {
    treeId: "G03-P000033",
    plantName: "Duri Hitam 149",
    jenis: "Duri Hitam",
    kondisi: "Buruk",
    badgeClass: "status-badge--red",
    note: "Data wiring in next feature step",
    updatedAt: "2026-02-15",
  },
  {
    treeId: "G03-P000038",
    plantName: "Bawor 18",
    jenis: "Bawor",
    kondisi: "Tersedia",
    badgeClass: "status-badge--cyan",
    note: "Preview layout only",
    updatedAt: "2026-02-15",
    placeholder: true,
  },
];

const legendItems = [
  { label: "Musangking", className: "legend-swatch--cyan" },
  { label: "Bawor", className: "legend-swatch--green" },
  { label: "Duri Hitam", className: "legend-swatch--amber" },
  { label: "Buruk", className: "legend-swatch--red" },
];

function App() {
  const [mapSnapshot, setMapSnapshot] = useState({
    loadState: "loading",
    dots: [],
    totalTrees: 0,
    message: "Loading synthetic coordinate layout",
  });

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
          message: "Failed to load synthetic coordinate layout",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
            <p className="filter-summary">Default focus: kondisi seluruh kebun</p>
          </div>

          <div className="filter-grid">
            <label className="control-block">
              <span className="control-label">Kategori</span>
              <select aria-label="Kategori" defaultValue="Jenis Tumbuhan">
                <option>Jenis Tumbuhan</option>
                <option>Kondisi</option>
              </select>
            </label>

            <label className="control-block">
              <span className="control-label">Nilai</span>
              <select aria-label="Nilai" defaultValue="Tampilkan Semua">
                <option>Tampilkan Semua</option>
                <option>Musangking</option>
                <option>Bawor</option>
                <option>Duri Hitam</option>
              </select>
            </label>

            <div className="active-context">
              <span className="context-label">Monitoring Context</span>
              <div className="context-values">
                <span className="context-chip">Garden 3</span>
                <span className="context-chip">Orthomosaic Ready</span>
                <span className="context-chip">Map Shell Only</span>
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
                <span className="legend-chip" key={item.label}>
                  <span className={`legend-swatch ${item.className}`} />
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
                {mapSnapshot.dots.map((dot) => (
                  <span
                    className={`map-dot ${dot.dotClassName}`}
                    key={dot.id}
                    style={{ left: `${dot.leftPercent}%`, top: `${dot.topPercent}%` }}
                    title={`${dot.treeIdDisplay} · ${dot.plantName}`}
                  />
                ))}

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
              <span>{mapSnapshot.message}</span>
            </div>

            <div className="map-overlay map-overlay--bottom-right">
              <p className="overlay-label">Visible Dots</p>
              <strong>{mapSnapshot.totalTrees} Trees</strong>
              <span>Garden 3 synthetic coordinate preview</span>
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
                <input type="text" value="" placeholder="Search Tree ID or notes" readOnly />
              </label>
              <span className="results-pill">27 rows</span>
            </div>
          </div>

          <div className="table-shell">
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
                {sampleRows.map((row) => (
                  <tr className={row.placeholder ? "placeholder-row" : ""} key={row.treeId}>
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
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
