import { useState } from "react";
import { ImageOverlay, MapContainer, ZoomControl } from "react-leaflet";

const DRONE_IMAGE_URL = "/dronentak.jpeg";
const FIT_BOUNDS_PADDING = [36, 36];

export function AdminOrchardWorkspace({
  imageBounds,
  loadState,
  totalUnmappedTrees,
  unmappedTrees,
}) {
  const [showMapInfo, setShowMapInfo] = useState(false);

  return (
    <main className="admin-workspace">
      <aside className="admin-panel admin-panel--sidebar" aria-label="Admin Unmapped Tree Queue">
        <div className="admin-panel__header">
          <div>
            <p className="section-kicker">Queue</p>
            <h2>Unmapped Trees</h2>
          </div>
          <span className="admin-count-pill">{totalUnmappedTrees} Pending</span>
        </div>

        <div className="admin-tree-list" role="list">
          {loadState === "loading" ? (
            <div className="admin-empty-state">
              <strong>Loading queue</strong>
              <span>Garden 3 seed data is being prepared.</span>
            </div>
          ) : loadState === "error" ? (
            <div className="admin-empty-state">
              <strong>Queue unavailable</strong>
              <span>Static unmapped tree snapshot could not be loaded.</span>
            </div>
          ) : (
            unmappedTrees.map((tree) => (
              <article className="admin-tree-row" key={tree.id} role="listitem">
                <div className="admin-tree-row__header">
                  <strong className="mono">{tree.treeIdDisplay}</strong>
                  <span className="admin-tree-badge">Pending</span>
                </div>
                <span className="admin-tree-name">{tree.plantName}</span>
                <div className="admin-tree-meta">
                  <span>{tree.plantTypeLabel}</span>
                  <span>{tree.createdAtLabel}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </aside>

      <section className="admin-panel admin-panel--map" aria-label="Admin Map Workspace">
        <div className="admin-panel__header">
          <div>
            <p className="section-kicker">Plotting Surface</p>
            <h2>Garden 3 Calibration Canvas</h2>
          </div>
          <div className="admin-panel__actions">
            <label className="admin-toggle" htmlFor="admin-map-info-toggle">
              <input
                id="admin-map-info-toggle"
                type="checkbox"
                checked={showMapInfo}
                onChange={() => setShowMapInfo((currentValue) => !currentValue)}
              />
              <span className="admin-toggle__track" aria-hidden="true">
                <span className="admin-toggle__thumb" />
              </span>
              <span className="admin-toggle__label">Show Map Info</span>
            </label>
            <span className="admin-count-pill admin-count-pill--map">Leaflet Ready</span>
          </div>
        </div>

        <div className="admin-map-viewport">
          {imageBounds ? (
            <MapContainer
              attributionControl={false}
              bounds={imageBounds}
              boundsOptions={{ padding: FIT_BOUNDS_PADDING }}
              className="admin-map-leaflet"
              maxBounds={imageBounds}
              maxBoundsViscosity={1}
              maxZoom={24}
              preferCanvas
              scrollWheelZoom
              zoomControl={false}
              zoomDelta={0.5}
              zoomSnap={0.25}
            >
              <ZoomControl position="topright" />
              <ImageOverlay bounds={imageBounds} opacity={1} url={DRONE_IMAGE_URL} />
            </MapContainer>
          ) : (
            <div className="admin-map-placeholder" />
          )}

          <div className="admin-map-scrim" />
          <div className="admin-map-grid" />

          {showMapInfo ? (
            <>
              <div className="admin-map-overlay admin-map-overlay--top-left">
                <p className="overlay-label">Mapping Status</p>
                <strong>
                  {loadState === "ready" ? "Awaiting tree selection" : "Loading workspace"}
                </strong>
                <span>Click-to-plot will attach here in the next step.</span>
              </div>

              <div className="admin-map-overlay admin-map-overlay--bottom-right">
                <p className="overlay-label">Pending Queue</p>
                <strong>{totalUnmappedTrees} Trees</strong>
                <span>Garden 3 remains in setup mode.</span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
