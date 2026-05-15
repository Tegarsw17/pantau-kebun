import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  ZoomControl,
  useMapEvents,
} from "react-leaflet";
import { saveAdminTreePlacement } from "../data/adminOrchardSupabase.js";
import { CalibratedImageOverlay } from "./CalibratedImageOverlay.jsx";
import { DEFAULT_GARDEN_3_DRONE_CALIBRATION } from "../data/loadDroneCalibration.js";

const FIT_BOUNDS_PADDING = [36, 36];

function AdminPlottingBridge({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

function upsertMappedPlacement(currentPlacements, tree, latlng) {
  const nextPlacement = {
    ...tree,
    latlng,
  };
  const existingIndex = currentPlacements.findIndex((placement) => placement.id === tree.id);

  if (existingIndex === -1) {
    return [...currentPlacements, nextPlacement];
  }

  return currentPlacements.map((placement) => (placement.id === tree.id ? nextPlacement : placement));
}

export function AdminOrchardWorkspace({
  dataSource,
  imageCalibration,
  imageBounds,
  loadState,
  mappedTrees,
  unmappedTrees,
}) {
  const [showMapInfo, setShowMapInfo] = useState(false);
  const [repositionMode, setRepositionMode] = useState(false);
  const [queueTrees, setQueueTrees] = useState(unmappedTrees);
  const [mappedPlacements, setMappedPlacements] = useState(mappedTrees);
  const [selectedTreeSelection, setSelectedTreeSelection] = useState(null);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSavingPlacement, setIsSavingPlacement] = useState(false);

  useEffect(() => {
    setQueueTrees(unmappedTrees);
    setMappedPlacements(mappedTrees);
    setSelectedTreeSelection(null);
    setPendingPlacement(null);
    setFeedback(null);
    setIsSavingPlacement(false);
  }, [mappedTrees, unmappedTrees]);

  useEffect(() => {
    if (feedback == null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const selectedTree =
    selectedTreeSelection?.scope === "queue"
      ? queueTrees.find((tree) => tree.id === selectedTreeSelection.treeId) ?? null
      : selectedTreeSelection?.scope === "mapped"
        ? mappedPlacements.find((tree) => tree.id === selectedTreeSelection.treeId) ?? null
        : null;
  const selectedTreeScope = selectedTreeSelection?.scope ?? null;
  const isPlottingMode = Boolean(selectedTree);
  const resolvedCalibration = imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION;

  useEffect(() => {
    if (selectedTreeSelection == null) {
      return;
    }

    if (selectedTreeSelection.scope === "mapped" && !repositionMode) {
      setSelectedTreeSelection(null);
      setPendingPlacement(null);
      return;
    }

    const selectionExists =
      selectedTreeSelection.scope === "queue"
        ? queueTrees.some((tree) => tree.id === selectedTreeSelection.treeId)
        : mappedPlacements.some((tree) => tree.id === selectedTreeSelection.treeId);

    if (!selectionExists) {
      setSelectedTreeSelection(null);
      setPendingPlacement(null);
    }
  }, [mappedPlacements, queueTrees, repositionMode, selectedTreeSelection]);

  const handleTreeSelect = (tree, scope) => {
    if (isSavingPlacement) {
      return;
    }

    setFeedback(null);
    setPendingPlacement(null);
    setSelectedTreeSelection((currentValue) =>
      currentValue?.scope === scope && currentValue.treeId === tree.id
        ? null
        : { scope, treeId: tree.id },
    );
  };

  const handleMapClick = (latlng) => {
    if (isSavingPlacement) {
      return;
    }

    if (selectedTree == null) {
      setFeedback({
        tone: "warning",
        message: repositionMode
          ? "Select a tree from queue or mapped list before clicking the map."
          : "Select a tree first, then click the map to place a draft point.",
      });
      return;
    }

    setPendingPlacement({
      latlng,
      scope: selectedTreeScope,
      tree: selectedTree,
    });
  };

  const handleConfirmPlacement = async () => {
    if (pendingPlacement == null) {
      return;
    }

    const { latlng, scope, tree } = pendingPlacement;

    if (dataSource === "supabase") {
      setIsSavingPlacement(true);

      try {
        const savedPlacement = await saveAdminTreePlacement({
          plantId: tree.id,
          latitude: latlng.lat,
          longitude: latlng.lng,
        });

        setMappedPlacements((currentValue) =>
          upsertMappedPlacement(currentValue, tree, {
            lat: savedPlacement.latitude,
            lng: savedPlacement.longitude,
          }),
        );
        setQueueTrees((currentValue) =>
          scope === "queue" ? currentValue.filter((item) => item.id !== tree.id) : currentValue,
        );
        setPendingPlacement(null);
        setSelectedTreeSelection(null);
        setFeedback({
          tone: "success",
          message:
            scope === "mapped"
              ? `Position updated for ${tree.treeIdDisplay}.`
              : `Position saved for ${tree.treeIdDisplay}.`,
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : `Failed to save position for ${tree.treeIdDisplay}.`,
        });
      } finally {
        setIsSavingPlacement(false);
      }

      return;
    }

    setMappedPlacements((currentValue) => upsertMappedPlacement(currentValue, tree, latlng));
    setQueueTrees((currentValue) =>
      scope === "queue" ? currentValue.filter((item) => item.id !== tree.id) : currentValue,
    );
    setPendingPlacement(null);
    setSelectedTreeSelection(null);
    setFeedback({
      tone: "success",
      message:
        scope === "mapped"
          ? `Position staged locally for ${tree.treeIdDisplay}.`
          : `Position staged locally for ${tree.treeIdDisplay}. Supabase sync is not configured yet.`,
    });
  };

  const handleCancelPlacement = () => {
    if (pendingPlacement == null || isSavingPlacement) {
      return;
    }

    setFeedback({
      tone: "neutral",
      message: `Draft position cleared for ${pendingPlacement.tree.treeIdDisplay}.`,
    });
    setPendingPlacement(null);
  };

  const handleRepositionToggle = () => {
    setRepositionMode((currentValue) => !currentValue);
    setPendingPlacement(null);
    setFeedback(null);
    setSelectedTreeSelection((currentValue) =>
      currentValue?.scope === "mapped" ? null : currentValue,
    );
  };

  return (
    <main className="admin-workspace">
      <aside className="admin-panel admin-panel--sidebar" aria-label="Admin Tree Workspace">
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
              <span>Garden 3 queue data is being prepared.</span>
            </div>
          ) : loadState === "error" ? (
            <div className="admin-empty-state">
              <strong>Queue unavailable</strong>
              <span>Orchard queue data could not be loaded.</span>
            </div>
          ) : queueTrees.length === 0 ? (
            <div className="admin-empty-state">
              <strong>Queue complete</strong>
              <span>All Garden 3 trees are mapped in this workspace.</span>
            </div>
          ) : (
            queueTrees.map((tree) => (
              <article
                className={`admin-tree-row ${
                  selectedTreeSelection?.scope === "queue" && selectedTreeSelection.treeId === tree.id
                    ? "admin-tree-row--selected"
                    : ""
                } ${isSavingPlacement ? "admin-tree-row--disabled" : ""}`}
                key={tree.id}
                onClick={() => handleTreeSelect(tree, "queue")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleTreeSelect(tree, "queue");
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

        {repositionMode ? (
          <>
            <div className="admin-map-divider" />

            <div className="admin-panel__header admin-panel__header--compact">
              <div>
                <p className="section-kicker">Reposition</p>
                <h2>Mapped Trees</h2>
              </div>
              <span className="admin-count-pill admin-count-pill--map">{mappedPlacements.length} Active</span>
            </div>

            <div className="admin-tree-list admin-tree-list--mapped" role="list">
              {mappedPlacements.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No mapped trees</strong>
                  <span>Load a mapped dataset to enable repositioning.</span>
                </div>
              ) : (
                mappedPlacements.map((placement) => (
                  <article
                    className={`admin-tree-row admin-tree-row--mapped ${
                      selectedTreeSelection?.scope === "mapped" &&
                      selectedTreeSelection.treeId === placement.id
                        ? "admin-tree-row--selected"
                        : ""
                    } ${isSavingPlacement ? "admin-tree-row--disabled" : ""}`}
                    key={placement.id}
                    onClick={() => handleTreeSelect(placement, "mapped")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTreeSelect(placement, "mapped");
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="admin-tree-row__header">
                      <strong className="mono">{placement.treeIdDisplay}</strong>
                      <span className="admin-tree-badge admin-tree-badge--mapped">Mapped</span>
                    </div>
                    <span className="admin-tree-name">{placement.plantName}</span>
                    <div className="admin-tree-meta">
                      <span>{placement.plantTypeLabel}</span>
                      <span>
                        {placement.latlng.lat.toFixed(6)} / {placement.latlng.lng.toFixed(6)}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        ) : null}
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
            <label className="admin-toggle" htmlFor="admin-reposition-toggle">
              <input
                id="admin-reposition-toggle"
                type="checkbox"
                checked={repositionMode}
                onChange={handleRepositionToggle}
              />
              <span className="admin-toggle__track" aria-hidden="true">
                <span className="admin-toggle__thumb" />
              </span>
              <span className="admin-toggle__label">Reposition Existing</span>
            </label>
            <span className="admin-count-pill admin-count-pill--map">Leaflet Ready</span>
            <span className="admin-count-pill admin-count-pill--map">
              {dataSource === "supabase" ? "Supabase Sync" : "Session Only"}
            </span>
          </div>
        </div>

        <div className={`admin-mapping-banner ${isPlottingMode ? "admin-mapping-banner--active" : ""}`}>
          <p className="overlay-label">{repositionMode ? "Reposition Mode" : "Plotting Mode"}</p>
          <strong>
            {selectedTree
              ? `Currently Mapping: ${selectedTree.treeIdDisplay}`
              : repositionMode
                ? "Enable repositioning and select an existing marker."
                : "Select a tree to begin plotting."}
          </strong>
          <span>
            {selectedTree
              ? selectedTreeScope === "mapped"
                ? "Click the drone image to move this mapped tree, then confirm the popup."
                : "Click the drone image to place a draft point, then confirm the popup."
              : repositionMode
                ? "Existing dots become selectable when reposition mode is active."
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
              className={`admin-map-leaflet ${isPlottingMode ? "admin-map-leaflet--plotting" : ""} ${
                repositionMode ? "admin-map-leaflet--repositioning" : ""
              }`}
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
              <CalibratedImageOverlay
                corners={resolvedCalibration.corners}
                imageUrl={resolvedCalibration.imageUrl}
                opacity={1}
              />
              <AdminPlottingBridge onMapClick={handleMapClick} />
              {mappedPlacements.map((placement) => {
                const isSelectedMappedTree =
                  selectedTreeSelection?.scope === "mapped" &&
                  selectedTreeSelection.treeId === placement.id;

                return (
                  <CircleMarker
                    center={placement.latlng}
                    eventHandlers={
                      repositionMode
                        ? {
                            click(event) {
                              event.originalEvent?.stopPropagation();
                              handleTreeSelect(placement, "mapped");
                            },
                          }
                        : undefined
                    }
                    key={placement.id}
                    pathOptions={{
                      color: isSelectedMappedTree ? "#ffca5f" : "#57f287",
                      fillColor: isSelectedMappedTree ? "#ffca5f" : "#57f287",
                      fillOpacity: isSelectedMappedTree ? 0.96 : 0.88,
                      weight: 2,
                    }}
                    radius={isSelectedMappedTree ? 8 : 7}
                  />
                );
              })}
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
                        {pendingPlacement.scope === "mapped"
                          ? `Confirm new position for ${pendingPlacement.tree.treeIdDisplay}?`
                          : `Confirm position for ${pendingPlacement.tree.treeIdDisplay}?`}
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
                          disabled={isSavingPlacement}
                        >
                          {isSavingPlacement ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          className="admin-confirm-button"
                          type="button"
                          onClick={handleCancelPlacement}
                          disabled={isSavingPlacement}
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
                    : dataSource === "supabase"
                      ? "Confirmed points will write directly to plants.latitude and plants.longitude."
                      : "Confirmed points stay local until Supabase credentials are configured."}
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
