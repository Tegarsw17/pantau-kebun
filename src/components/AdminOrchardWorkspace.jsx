import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  deleteGardenDroneCalibrationRecord,
  fetchGardenDroneCalibrationRecord,
  saveAdminTreePlacement,
  saveGardenDroneCalibrationRecord,
} from "../data/adminOrchardSupabase.js";
import { CalibratedImageOverlay } from "./CalibratedImageOverlay.jsx";
import {
  clearStoredGarden3DroneCalibration,
  DEFAULT_GARDEN_3_DRONE_CALIBRATION,
  normalizeDroneCalibration,
  persistGarden3DroneCalibration,
  projectLayoutPointToCalibration,
  serializeDroneCalibration,
} from "../data/loadDroneCalibration.js";

const FIT_BOUNDS_PADDING = [36, 36];
const EARTH_RADIUS_METERS = 6378137;
const CALIBRATION_CENTER_NUDGE_METERS = 1;
const CALIBRATION_HEADING_FINE_STEP = 1;
const CALIBRATION_HEADING_COARSE_STEP = 5;
const CALIBRATION_SIZE_NUDGE_METERS = 5;
const CALIBRATION_SIZE_MIN_METERS = 1;

function AdminMapBridge({ imageBounds, onMapClick }) {
  const map = useMap();

  useEffect(() => {
    if (imageBounds == null) {
      return;
    }

    map.fitBounds(imageBounds, {
      animate: false,
      padding: FIT_BOUNDS_PADDING,
    });
    map.setMaxBounds(imageBounds);
  }, [imageBounds, map]);

  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

function stripLayoutPosition(tree) {
  const { layoutPosition, ...treeWithoutLayoutPosition } = tree;
  return treeWithoutLayoutPosition;
}

function upsertMappedPlacement(currentPlacements, tree, latlng) {
  const nextPlacement = {
    ...stripLayoutPosition(tree),
    latlng,
  };
  const existingIndex = currentPlacements.findIndex((placement) => placement.id === tree.id);

  if (existingIndex === -1) {
    return [...currentPlacements, nextPlacement];
  }

  return currentPlacements.map((placement) => (placement.id === tree.id ? nextPlacement : placement));
}

function deriveLayoutExtent(placements) {
  const layoutAwarePlacements = placements.filter(
    (placement) =>
      typeof placement.layoutPosition?.x === "number" && typeof placement.layoutPosition?.y === "number",
  );

  if (layoutAwarePlacements.length === 0) {
    return null;
  }

  const xValues = layoutAwarePlacements.map((placement) => placement.layoutPosition.x);
  const yValues = layoutAwarePlacements.map((placement) => placement.layoutPosition.y);

  return {
    maxX: Math.max(...xValues),
    maxY: Math.max(...yValues),
    minX: Math.min(...xValues),
    minY: Math.min(...yValues),
  };
}

function projectPlacementWithCalibration(placement, calibration, layoutExtent) {
  if (
    layoutExtent == null ||
    typeof placement.layoutPosition?.x !== "number" ||
    typeof placement.layoutPosition?.y !== "number"
  ) {
    return placement;
  }

  return {
    ...placement,
    latlng: projectLayoutPointToCalibration(placement.layoutPosition, layoutExtent, calibration),
  };
}

function calibrationSignaturesMatch(leftCalibration, rightCalibration) {
  return (
    JSON.stringify(serializeDroneCalibration(leftCalibration)) ===
    JSON.stringify(serializeDroneCalibration(rightCalibration))
  );
}

function updateCalibrationField(currentCalibration, patch) {
  return normalizeDroneCalibration({
    ...serializeDroneCalibration(currentCalibration),
    ...patch,
  });
}

function normalizeBearingDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function offsetPointByMeters(point, bearingDegrees, distanceMeters) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const startLatitude = (point.lat * Math.PI) / 180;
  const startLongitude = (point.lng * Math.PI) / 180;

  const destinationLatitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance) +
      Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const destinationLongitude =
    startLongitude +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(startLatitude),
      Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(destinationLatitude),
    );

  return {
    lat: (destinationLatitude * 180) / Math.PI,
    lng: ((destinationLongitude * 180) / Math.PI + 540) % 360 - 180,
  };
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
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [queueTrees, setQueueTrees] = useState(unmappedTrees);
  const [mappedPlacements, setMappedPlacements] = useState(mappedTrees);
  const [persistedCalibration, setPersistedCalibration] = useState(
    imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION,
  );
  const [workingCalibration, setWorkingCalibration] = useState(
    imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION,
  );
  const [selectedTreeSelection, setSelectedTreeSelection] = useState(null);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isSavingPlacement, setIsSavingPlacement] = useState(false);
  const [isSavingCalibration, setIsSavingCalibration] = useState(false);

  useEffect(() => {
    setQueueTrees(unmappedTrees);
    setMappedPlacements(mappedTrees);
    setPersistedCalibration(imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION);
    setWorkingCalibration(imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION);
    setSelectedTreeSelection(null);
    setPendingPlacement(null);
    setFeedback(null);
    setIsSavingPlacement(false);
    setIsSavingCalibration(false);
  }, [imageCalibration, mappedTrees, unmappedTrees]);

  useEffect(() => {
    if (feedback == null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const resolvedCalibration = workingCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION;
  const resolvedMapBounds = resolvedCalibration.mapBounds ?? imageBounds ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION.mapBounds;
  const layoutExtent = useMemo(() => deriveLayoutExtent(mappedPlacements), [mappedPlacements]);
  const renderedMappedPlacements = useMemo(
    () =>
      mappedPlacements.map((placement) =>
        dataSource === "supabase"
          ? placement
          : projectPlacementWithCalibration(placement, resolvedCalibration, layoutExtent),
      ),
    [dataSource, layoutExtent, mappedPlacements, resolvedCalibration],
  );
  const selectedTree =
    selectedTreeSelection?.scope === "queue"
      ? queueTrees.find((tree) => tree.id === selectedTreeSelection.treeId) ?? null
      : selectedTreeSelection?.scope === "mapped"
        ? renderedMappedPlacements.find((tree) => tree.id === selectedTreeSelection.treeId) ?? null
        : null;
  const selectedTreeScope = selectedTreeSelection?.scope ?? null;
  const isPlottingMode = Boolean(selectedTree);
  const isTreeSelectionLocked = isSavingPlacement || isSavingCalibration || calibrationMode;
  const hasCalibrationChanges = !calibrationSignaturesMatch(workingCalibration, persistedCalibration);

  useEffect(() => {
    if (selectedTreeSelection == null) {
      return;
    }

    if (calibrationMode) {
      setSelectedTreeSelection(null);
      setPendingPlacement(null);
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
        : renderedMappedPlacements.some((tree) => tree.id === selectedTreeSelection.treeId);

    if (!selectionExists) {
      setSelectedTreeSelection(null);
      setPendingPlacement(null);
    }
  }, [calibrationMode, queueTrees, renderedMappedPlacements, repositionMode, selectedTreeSelection]);

  const handleTreeSelect = (tree, scope) => {
    if (isTreeSelectionLocked) {
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
    if (isSavingPlacement || isSavingCalibration) {
      return;
    }

    if (calibrationMode) {
      setWorkingCalibration((currentCalibration) =>
        updateCalibrationField(currentCalibration, {
          center: {
            lat: latlng.lat,
            lng: latlng.lng,
          },
        }),
      );
      setPendingPlacement(null);
      setSelectedTreeSelection(null);
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
    setCalibrationMode(false);
    setPendingPlacement(null);
    setFeedback(null);
    setSelectedTreeSelection(null);
  };

  const handleCalibrationToggle = () => {
    setCalibrationMode((currentValue) => !currentValue);
    setRepositionMode(false);
    setPendingPlacement(null);
    setFeedback(null);
    setSelectedTreeSelection(null);
  };

  const applyCalibrationNudge = (updater) => {
    if (isSavingCalibration) {
      return;
    }

    setWorkingCalibration((currentCalibration) => updater(currentCalibration));
    setFeedback(null);
  };

  const handleCenterNudge = (bearingDegrees) => {
    applyCalibrationNudge((currentCalibration) =>
      updateCalibrationField(currentCalibration, {
        center: offsetPointByMeters(
          currentCalibration.center,
          bearingDegrees,
          CALIBRATION_CENTER_NUDGE_METERS,
        ),
      }),
    );
  };

  const handleHeadingNudge = (deltaDegrees) => {
    applyCalibrationNudge((currentCalibration) =>
      updateCalibrationField(currentCalibration, {
        heading_degrees: normalizeBearingDegrees(currentCalibration.headingDegrees + deltaDegrees),
      }),
    );
  };

  const handleSizeNudge = (dimensionKey, deltaMeters) => {
    applyCalibrationNudge((currentCalibration) => {
      const currentSize = currentCalibration.sizeMeters?.[dimensionKey] ?? CALIBRATION_SIZE_MIN_METERS;
      const nextSize = Math.max(CALIBRATION_SIZE_MIN_METERS, currentSize + deltaMeters);

      return updateCalibrationField(currentCalibration, {
        [dimensionKey === "width" ? "width_meters" : "height_meters"]: nextSize,
      });
    });
  };

  const handleCalibrationSave = () => {
    if (isSavingCalibration) {
      return;
    }

    void (async () => {
      setIsSavingCalibration(true);

      try {
        if (dataSource === "supabase") {
          const savedRecord = await saveGardenDroneCalibrationRecord({
            calibration: serializeDroneCalibration(workingCalibration),
            gardenId: workingCalibration.gardenId ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION.gardenId,
          });
          const normalizedCalibration = normalizeDroneCalibration(savedRecord.calibration);
          persistGarden3DroneCalibration(normalizedCalibration);
          setPersistedCalibration(normalizedCalibration);
          setWorkingCalibration(normalizedCalibration);
          setFeedback({
            tone: "success",
            message: "Calibration saved to Supabase.",
          });
          return;
        }

        const didPersist = persistGarden3DroneCalibration(workingCalibration);

        if (!didPersist) {
          setFeedback({
            tone: "error",
            message: "Calibration override could not be stored in this browser.",
          });
          return;
        }

        setPersistedCalibration(workingCalibration);
        setFeedback({
          tone: "success",
          message: "Calibration override saved to browser storage.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Calibration could not be saved.",
        });
      } finally {
        setIsSavingCalibration(false);
      }
    })();
  };

  const handleCalibrationRevert = () => {
    if (isSavingCalibration) {
      return;
    }

    setWorkingCalibration(persistedCalibration);
    setFeedback({
      tone: "neutral",
      message: "Calibration draft reverted to the last saved state.",
    });
  };

  const handleCalibrationReload = () => {
    if (isSavingCalibration || dataSource !== "supabase") {
      return;
    }

    void (async () => {
      setIsSavingCalibration(true);

      try {
        const calibrationRecord = await fetchGardenDroneCalibrationRecord(
          DEFAULT_GARDEN_3_DRONE_CALIBRATION.gardenId,
        );

        if (calibrationRecord?.calibration == null) {
          clearStoredGarden3DroneCalibration();
          setPersistedCalibration(DEFAULT_GARDEN_3_DRONE_CALIBRATION);
          setWorkingCalibration(DEFAULT_GARDEN_3_DRONE_CALIBRATION);
          setFeedback({
            tone: "neutral",
            message: "No saved Supabase calibration was found. Bundled default reloaded.",
          });
          return;
        }

        const normalizedCalibration = normalizeDroneCalibration(calibrationRecord.calibration);
        persistGarden3DroneCalibration(normalizedCalibration);
        setPersistedCalibration(normalizedCalibration);
        setWorkingCalibration(normalizedCalibration);
        setFeedback({
          tone: "success",
          message: "Calibration reloaded from Supabase.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Calibration could not be reloaded from Supabase.",
        });
      } finally {
        setIsSavingCalibration(false);
      }
    })();
  };

  const handleCalibrationBaseline = () => {
    if (isSavingCalibration) {
      return;
    }

    const baselineCalibration = normalizeDroneCalibration(
      serializeDroneCalibration(DEFAULT_GARDEN_3_DRONE_CALIBRATION),
    );

    setWorkingCalibration(baselineCalibration);
    setFeedback({
      tone: "neutral",
      message: "Original field baseline loaded into the draft. Save to persist it.",
    });
  };

  const handleCalibrationReset = () => {
    if (isSavingCalibration) {
      return;
    }

    void (async () => {
      setIsSavingCalibration(true);

      try {
        const didClearStorage = clearStoredGarden3DroneCalibration();

        if (!didClearStorage && dataSource !== "supabase") {
          setFeedback({
            tone: "error",
            message: "Calibration override could not be cleared from this browser.",
          });
          return;
        }

        if (dataSource === "supabase") {
          await deleteGardenDroneCalibrationRecord(
            DEFAULT_GARDEN_3_DRONE_CALIBRATION.gardenId,
          );
        }

        setPersistedCalibration(DEFAULT_GARDEN_3_DRONE_CALIBRATION);
        setWorkingCalibration(DEFAULT_GARDEN_3_DRONE_CALIBRATION);
        setFeedback({
          tone: "success",
          message:
            dataSource === "supabase"
              ? "Calibration reset to the bundled default and cleared from Supabase."
              : "Calibration reset to the bundled Garden 3 default.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Calibration could not be reset.",
        });
      } finally {
        setIsSavingCalibration(false);
      }
    })();
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
                } ${isTreeSelectionLocked ? "admin-tree-row--disabled" : ""}`}
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

        {calibrationMode ? (
          <>
            <div className="admin-map-divider" />

            <section className="admin-calibration-panel" aria-label="Calibration Editor">
              <div className="admin-panel__header admin-panel__header--compact">
                <div>
                  <p className="section-kicker">Calibration</p>
                  <h2>Drone Editor</h2>
                </div>
                <span className={`admin-count-pill admin-count-pill--map ${hasCalibrationChanges ? "admin-count-pill--alert" : ""}`}>
                  {hasCalibrationChanges ? "Unsaved" : "Saved"}
                </span>
              </div>

              <p className="admin-calibration-copy">
                Click the map to move the image center, then tune heading and footprint size here.
              </p>

              <div className="admin-calibration-grid">
                <label className="admin-calibration-field">
                  <span className="control-label">Center Latitude</span>
                  <input
                    className="admin-calibration-input"
                    type="number"
                    step="0.000001"
                    disabled={isSavingCalibration}
                    value={resolvedCalibration.center.lat}
                    onChange={(event) => {
                      const latitude = Number(event.target.value);

                      setWorkingCalibration((currentCalibration) =>
                        updateCalibrationField(currentCalibration, {
                          center: {
                            ...currentCalibration.center,
                            lat: Number.isFinite(latitude) ? latitude : currentCalibration.center.lat,
                          },
                        }),
                      );
                    }}
                  />
                </label>

                <label className="admin-calibration-field">
                  <span className="control-label">Center Longitude</span>
                  <input
                    className="admin-calibration-input"
                    type="number"
                    step="0.000001"
                    disabled={isSavingCalibration}
                    value={resolvedCalibration.center.lng}
                    onChange={(event) => {
                      const longitude = Number(event.target.value);

                      setWorkingCalibration((currentCalibration) =>
                        updateCalibrationField(currentCalibration, {
                          center: {
                            ...currentCalibration.center,
                            lng: Number.isFinite(longitude) ? longitude : currentCalibration.center.lng,
                          },
                        }),
                      );
                    }}
                  />
                </label>

                <label className="admin-calibration-field">
                  <span className="control-label">Heading</span>
                  <input
                    className="admin-calibration-input"
                    type="number"
                    min="0"
                    max="359"
                    step="1"
                    disabled={isSavingCalibration}
                    value={resolvedCalibration.headingDegrees}
                    onChange={(event) => {
                      const heading = Number(event.target.value);

                      setWorkingCalibration((currentCalibration) =>
                        updateCalibrationField(currentCalibration, {
                          heading_degrees: Number.isFinite(heading)
                            ? heading
                            : currentCalibration.headingDegrees,
                        }),
                      );
                    }}
                  />
                </label>

                <label className="admin-calibration-field">
                  <span className="control-label">Width (m)</span>
                  <input
                    className="admin-calibration-input"
                    type="number"
                    min="1"
                    step="1"
                    disabled={isSavingCalibration}
                    value={resolvedCalibration.sizeMeters.width}
                    onChange={(event) => {
                      const width = Number(event.target.value);

                      setWorkingCalibration((currentCalibration) =>
                        updateCalibrationField(currentCalibration, {
                          width_meters: Number.isFinite(width) ? width : currentCalibration.sizeMeters.width,
                        }),
                      );
                    }}
                  />
                </label>

                <label className="admin-calibration-field">
                  <span className="control-label">Height (m)</span>
                  <input
                    className="admin-calibration-input"
                    type="number"
                    min="1"
                    step="1"
                    disabled={isSavingCalibration}
                    value={resolvedCalibration.sizeMeters.height}
                    onChange={(event) => {
                      const height = Number(event.target.value);

                      setWorkingCalibration((currentCalibration) =>
                        updateCalibrationField(currentCalibration, {
                          height_meters: Number.isFinite(height) ? height : currentCalibration.sizeMeters.height,
                        }),
                      );
                    }}
                  />
                </label>
              </div>

              <div className="admin-calibration-quicktools" aria-label="Calibration Nudge Controls">
                <div className="admin-calibration-step-group">
                  <div className="admin-calibration-step-group__header">
                    <span className="control-label">Center Nudge</span>
                    <span className="admin-calibration-step-meta">
                      {CALIBRATION_CENTER_NUDGE_METERS}m step
                    </span>
                  </div>
                  <div className="admin-calibration-step-grid admin-calibration-step-grid--center">
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleCenterNudge(0)}
                      disabled={isSavingCalibration}
                    >
                      N
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleCenterNudge(270)}
                      disabled={isSavingCalibration}
                    >
                      W
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleCenterNudge(90)}
                      disabled={isSavingCalibration}
                    >
                      E
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleCenterNudge(180)}
                      disabled={isSavingCalibration}
                    >
                      S
                    </button>
                  </div>
                </div>

                <div className="admin-calibration-step-group">
                  <div className="admin-calibration-step-group__header">
                    <span className="control-label">Heading Nudge</span>
                    <span className="admin-calibration-step-meta">1° and 5° steps</span>
                  </div>
                  <div className="admin-calibration-step-grid">
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleHeadingNudge(-CALIBRATION_HEADING_COARSE_STEP)}
                      disabled={isSavingCalibration}
                    >
                      -5°
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleHeadingNudge(-CALIBRATION_HEADING_FINE_STEP)}
                      disabled={isSavingCalibration}
                    >
                      -1°
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleHeadingNudge(CALIBRATION_HEADING_FINE_STEP)}
                      disabled={isSavingCalibration}
                    >
                      +1°
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleHeadingNudge(CALIBRATION_HEADING_COARSE_STEP)}
                      disabled={isSavingCalibration}
                    >
                      +5°
                    </button>
                  </div>
                </div>

                <div className="admin-calibration-step-group">
                  <div className="admin-calibration-step-group__header">
                    <span className="control-label">Footprint Nudge</span>
                    <span className="admin-calibration-step-meta">
                      {CALIBRATION_SIZE_NUDGE_METERS}m size step
                    </span>
                  </div>
                  <div className="admin-calibration-step-grid">
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleSizeNudge("width", -CALIBRATION_SIZE_NUDGE_METERS)}
                      disabled={isSavingCalibration}
                    >
                      Width -5m
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleSizeNudge("width", CALIBRATION_SIZE_NUDGE_METERS)}
                      disabled={isSavingCalibration}
                    >
                      Width +5m
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleSizeNudge("height", -CALIBRATION_SIZE_NUDGE_METERS)}
                      disabled={isSavingCalibration}
                    >
                      Height -5m
                    </button>
                    <button
                      className="admin-secondary-button admin-secondary-button--compact"
                      type="button"
                      onClick={() => handleSizeNudge("height", CALIBRATION_SIZE_NUDGE_METERS)}
                      disabled={isSavingCalibration}
                    >
                      Height +5m
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-calibration-meta">
                <span>Mode: center / heading / size</span>
                <span>Top bearing: {resolvedCalibration.headingDegrees}°</span>
                <span>
                  Footprint: {resolvedCalibration.sizeMeters.width}m x {resolvedCalibration.sizeMeters.height}m
                </span>
              </div>

              <div className="admin-calibration-actions">
                <button
                  className="admin-secondary-button admin-secondary-button--primary"
                  type="button"
                  onClick={handleCalibrationSave}
                  disabled={!hasCalibrationChanges || isSavingCalibration}
                >
                  {isSavingCalibration ? "Saving..." : "Save Calibration"}
                </button>
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={handleCalibrationRevert}
                  disabled={!hasCalibrationChanges || isSavingCalibration}
                >
                  Revert
                </button>
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={handleCalibrationBaseline}
                  disabled={isSavingCalibration}
                >
                  Use Field Baseline
                </button>
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={handleCalibrationReload}
                  disabled={isSavingCalibration || dataSource !== "supabase"}
                >
                  Reload Saved
                </button>
                <button
                  className="admin-secondary-button"
                  type="button"
                  onClick={handleCalibrationReset}
                  disabled={isSavingCalibration}
                >
                  Reset Default
                </button>
              </div>
            </section>
          </>
        ) : repositionMode ? (
          <>
            <div className="admin-map-divider" />

            <div className="admin-panel__header admin-panel__header--compact">
              <div>
                <p className="section-kicker">Reposition</p>
                <h2>Mapped Trees</h2>
              </div>
              <span className="admin-count-pill admin-count-pill--map">
                {renderedMappedPlacements.length} Active
              </span>
            </div>

            <div className="admin-tree-list admin-tree-list--mapped" role="list">
              {renderedMappedPlacements.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No mapped trees</strong>
                  <span>Load a mapped dataset to enable repositioning.</span>
                </div>
              ) : (
                renderedMappedPlacements.map((placement) => (
                  <article
                    className={`admin-tree-row admin-tree-row--mapped ${
                      selectedTreeSelection?.scope === "mapped" &&
                      selectedTreeSelection.treeId === placement.id
                        ? "admin-tree-row--selected"
                        : ""
                    } ${isTreeSelectionLocked ? "admin-tree-row--disabled" : ""}`}
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
            <label className="admin-toggle" htmlFor="admin-calibration-toggle">
              <input
                id="admin-calibration-toggle"
                type="checkbox"
                checked={calibrationMode}
                onChange={handleCalibrationToggle}
              />
              <span className="admin-toggle__track" aria-hidden="true">
                <span className="admin-toggle__thumb" />
              </span>
              <span className="admin-toggle__label">Calibration Editor</span>
            </label>
            <span className="admin-count-pill admin-count-pill--map">Leaflet Ready</span>
            <span className="admin-count-pill admin-count-pill--map">
              {dataSource === "supabase" ? "Supabase Sync" : "Session Only"}
            </span>
          </div>
        </div>

        <div className={`admin-mapping-banner ${isPlottingMode || calibrationMode ? "admin-mapping-banner--active" : ""}`}>
          <p className="overlay-label">
            {calibrationMode ? "Calibration Editor" : repositionMode ? "Reposition Mode" : "Plotting Mode"}
          </p>
          <strong>
            {calibrationMode
              ? "Click the map to move the drone image center."
              : selectedTree
                ? `Currently Mapping: ${selectedTree.treeIdDisplay}`
                : repositionMode
                  ? "Enable repositioning and select an existing marker."
                  : "Select a tree to begin plotting."}
          </strong>
          <span>
            {calibrationMode
              ? "Tune heading, width, and height from the sidebar, then save the override to this browser."
              : selectedTree
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
          {resolvedMapBounds ? (
            <MapContainer
              attributionControl={false}
              bounds={resolvedMapBounds}
              boundsOptions={{ padding: FIT_BOUNDS_PADDING }}
              className={`admin-map-leaflet ${isPlottingMode || calibrationMode ? "admin-map-leaflet--plotting" : ""} ${repositionMode ? "admin-map-leaflet--repositioning" : ""} ${calibrationMode ? "admin-map-leaflet--calibrating" : ""}`}
              maxBounds={resolvedMapBounds}
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
              <AdminMapBridge imageBounds={resolvedMapBounds} onMapClick={handleMapClick} />

              {calibrationMode ? (
                <>
                  <Polyline
                    pathOptions={{
                      color: "#ffca5f",
                      dashArray: "10 8",
                      fill: false,
                      weight: 2,
                    }}
                    positions={[...resolvedCalibration.corners, resolvedCalibration.corners[0]]}
                  />
                  {resolvedCalibration.corners.map((corner, index) => (
                    <CircleMarker
                      center={corner}
                      key={`corner-${index}`}
                      pathOptions={{
                        color: "#3ce6ff",
                        fillColor: "#3ce6ff",
                        fillOpacity: 0.9,
                        weight: 2,
                      }}
                      radius={5}
                    />
                  ))}
                  <CircleMarker
                    center={resolvedCalibration.center}
                    pathOptions={{
                      color: "#ff9b54",
                      fillColor: "#ff9b54",
                      fillOpacity: 0.94,
                      weight: 2,
                    }}
                    radius={8}
                  />
                </>
              ) : null}

              {renderedMappedPlacements.map((placement) => {
                const isSelectedMappedTree =
                  selectedTreeSelection?.scope === "mapped" &&
                  selectedTreeSelection.treeId === placement.id;
                const mappedTreeColor = placement.plantTypeColor ?? "#57f287";

                return (
                  <CircleMarker
                    center={placement.latlng}
                    eventHandlers={
                      repositionMode && !calibrationMode
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
                      color: isSelectedMappedTree ? "#ffca5f" : mappedTreeColor,
                      fillColor: isSelectedMappedTree ? "#ffca5f" : mappedTreeColor,
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
                <strong>
                  {calibrationMode
                    ? "Calibration editing active"
                    : loadState === "ready"
                      ? "Awaiting tree selection"
                      : "Loading workspace"}
                </strong>
                <span>
                  {calibrationMode
                    ? `Center ${resolvedCalibration.center.lat.toFixed(6)}, ${resolvedCalibration.center.lng.toFixed(6)}`
                    : selectedTree
                      ? `Currently mapping ${selectedTree.treeIdDisplay}.`
                      : dataSource === "supabase"
                        ? "Confirmed points will write directly to plants.latitude and plants.longitude."
                        : "Confirmed points stay local until Supabase credentials are configured."}
                </span>
              </div>

              <div className="admin-map-overlay admin-map-overlay--bottom-right">
                <p className="overlay-label">{calibrationMode ? "Calibration Draft" : "Pending Queue"}</p>
                <strong>
                  {calibrationMode
                    ? `${resolvedCalibration.sizeMeters.width}m x ${resolvedCalibration.sizeMeters.height}m`
                    : `${queueTrees.length} Trees`}
                </strong>
                <span>
                  {calibrationMode
                    ? `${resolvedCalibration.headingDegrees}° top bearing`
                    : "Garden 3 remains in setup mode."}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
