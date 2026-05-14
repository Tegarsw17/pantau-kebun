import { useEffect, useState } from "react";
import { CircleMarker, ImageOverlay, MapContainer, Popup, ZoomControl, useMapEvents } from "react-leaflet";

const DRONE_IMAGE_URL = "/dronentak.jpeg";
const FIT_BOUNDS_PADDING = [36, 36];

function AdminPlottingBridge({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

export function AdminOrchardWorkspace({
  imageBounds,
  loadState,
  unmappedTrees,
}) {
  const [showMapInfo, setShowMapInfo] = useState(false);
  const [queueTrees, setQueueTrees] = useState(unmappedTrees);
  const [selectedTreeId, setSelectedTreeId] = useState(null);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [confirmedPlacements, setConfirmedPlacements] = useState([]);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setQueueTrees(unmappedTrees);
    setSelectedTreeId(null);
    setPendingPlacement(null);
    setConfirmedPlacements([]);
    setFeedback(null);
  }, [unmappedTrees]);

  useEffect(() => {
    if (feedback == null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const selectedTree = queueTrees.find((tree) => tree.id === selectedTreeId) ?? null;
  const isPlottingMode = Boolean(selectedTree);

  useEffect(() => {
    if (selectedTreeId !== null && selectedTree == null) {
      setSelectedTreeId(null);
      setPendingPlacement(null);
    }
  }, [selectedTree, selectedTreeId]);

  const handleTreeSelect = (tree) => {
    setFeedback(null);
    setPendingPlacement(null);
    setSelectedTreeId((currentValue) => (currentValue === tree.id ? null : tree.id));
  };

  const handleMapClick = (latlng) => {
    if (selectedTree == null) {
      setFeedback({
        tone: "warning",
        message: "Select a tree first, then click the map to place a draft point.",
      });
      return;
    }

    setPendingPlacement({
      latlng,
      tree: selectedTree,
    });
  };

  const handleConfirmPlacement = () => {
    if (pendingPlacement == null) {
      return;
    }

    const { latlng, tree } = pendingPlacement;

    setConfirmedPlacements((currentValue) => [
      ...currentValue,
      {
        latlng,
        tree,
      },
    ]);
    setQueueTrees((currentValue) => currentValue.filter((item) => item.id !== tree.id));
    setPendingPlacement(null);
    setSelectedTreeId(null);
    setFeedback({
      tone: "success",
      message: `Position confirmed for ${tree.treeIdDisplay}.`,
    });
  };

  const handleCancelPlacement = () => {
    if (pendingPlacement == null) {
      return;
    }

    setFeedback({
      tone: "neutral",
      message: `Draft position cleared for ${pendingPlacement.tree.treeIdDisplay}.`,
    });
    setPendingPlacement(null);
  };

  return (
    <main className="admin-workspace">
      <aside className="admin-panel admin-panel--sidebar" aria-label="Admin Unmapped Tree Queue">
        <div className="admin-panel__header">
          <div>
            <p className="section-kicker">Queue</p>
            <h2>Unmapped Trees</h2>
          </div>
          <span className="admin-count-pill">{queueTrees.length} Pending</span>
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
          ) : queueTrees.length === 0 ? (
            <div className="admin-empty-state">
              <strong>Queue complete</strong>
              <span>All Garden 3 trees are mapped in this prototype session.</span>
            </div>
          ) : (
            queueTrees.map((tree) => (
              <article
                className={`admin-tree-row ${selectedTreeId === tree.id ? "admin-tree-row--selected" : ""}`}
                key={tree.id}
                onClick={() => handleTreeSelect(tree)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleTreeSelect(tree);
                  }
                }}
                role="button"
                tabIndex={0}
              >
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

        <div className={`admin-mapping-banner ${isPlottingMode ? "admin-mapping-banner--active" : ""}`}>
          <p className="overlay-label">Plotting Mode</p>
          <strong>
            {selectedTree
              ? `Currently Mapping: ${selectedTree.treeIdDisplay}`
              : "Select a tree to begin plotting."}
          </strong>
          <span>
            {selectedTree
              ? "Click the drone image to place a draft point, then confirm the popup."
              : "Tree selection activates crosshair mode on the map."}
          </span>
        </div>

        {feedback ? (
          <div className={`admin-toast admin-toast--${feedback.tone}`} role="status">
            {feedback.message}
          </div>
        ) : null}

        <div className="admin-map-viewport">
          {imageBounds ? (
            <MapContainer
              attributionControl={false}
              bounds={imageBounds}
              boundsOptions={{ padding: FIT_BOUNDS_PADDING }}
              className={`admin-map-leaflet ${isPlottingMode ? "admin-map-leaflet--plotting" : ""}`}
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
              <AdminPlottingBridge onMapClick={handleMapClick} />
              {confirmedPlacements.map((placement) => (
                <CircleMarker
                  center={placement.latlng}
                  key={placement.tree.id}
                  pathOptions={{
                    color: "#57f287",
                    fillColor: "#57f287",
                    fillOpacity: 0.88,
                    weight: 2,
                  }}
                  radius={7}
                />
              ))}
              {pendingPlacement ? (
                <>
                  <CircleMarker
                    center={pendingPlacement.latlng}
                    pathOptions={{
                      color: "#ffca5f",
                      fillColor: "#ffca5f",
                      fillOpacity: 0.92,
                      weight: 2,
                    }}
                    radius={8}
                  />
                  <Popup
                    autoClose={false}
                    autoPan={false}
                    closeButton={false}
                    closeOnClick={false}
                    position={pendingPlacement.latlng}
                  >
                    <div className="admin-confirm-popup">
                      <strong>
                        Confirm position for {pendingPlacement.tree.treeIdDisplay}?
                      </strong>
                      <span>
                        Lat {pendingPlacement.latlng.lat.toFixed(6)}
                      </span>
                      <span>
                        Lng {pendingPlacement.latlng.lng.toFixed(6)}
                      </span>
                      <div className="admin-confirm-actions">
                        <button
                          className="admin-confirm-button admin-confirm-button--primary"
                          type="button"
                          onClick={handleConfirmPlacement}
                        >
                          Confirm
                        </button>
                        <button
                          className="admin-confirm-button"
                          type="button"
                          onClick={handleCancelPlacement}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Popup>
                </>
              ) : null}
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
                <strong>{loadState === "ready" ? "Awaiting tree selection" : "Loading workspace"}</strong>
                <span>
                  {selectedTree
                    ? `Currently mapping ${selectedTree.treeIdDisplay}.`
                    : "Click-to-plot will attach here in the next step."}
                </span>
              </div>

              <div className="admin-map-overlay admin-map-overlay--bottom-right">
                <p className="overlay-label">Pending Queue</p>
                <strong>{queueTrees.length} Trees</strong>
                <span>Garden 3 remains in setup mode.</span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
