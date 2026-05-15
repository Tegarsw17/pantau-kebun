import { useEffect, useState } from "react";
import { MapContainer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { CalibratedImageOverlay } from "./CalibratedImageOverlay.jsx";
import { DEFAULT_GARDEN_3_DRONE_CALIBRATION } from "../data/loadDroneCalibration.js";

const FIT_BOUNDS_PADDING = [36, 36];
const OVERLAY_DOT_MARGIN = 28;
const DEFAULT_IMAGE_BOUNDS = DEFAULT_GARDEN_3_DRONE_CALIBRATION.mapBounds;

function MapViewportBridge({ imageBounds, visibleDots, onViewportSync }) {
  const map = useMap();

  const syncProjectedDots = () => {
    const size = map.getSize();
    const projectedDots = visibleDots.map((dot) => {
      const point = map.latLngToContainerPoint([dot.latitude, dot.longitude]);

      return {
        ...dot,
        leftPx: point.x,
        topPx: point.y,
        isVisibleOnViewport:
          point.x >= -OVERLAY_DOT_MARGIN &&
          point.x <= size.x + OVERLAY_DOT_MARGIN &&
          point.y >= -OVERLAY_DOT_MARGIN &&
          point.y <= size.y + OVERLAY_DOT_MARGIN,
      };
    });

    onViewportSync({
      width: size.x,
      height: size.y,
      projectedDots,
    });
  };

  useMapEvents({
    load: syncProjectedDots,
    move: syncProjectedDots,
    zoom: syncProjectedDots,
    resize: syncProjectedDots,
  });

  useEffect(() => {
    map.setMaxBounds(imageBounds);
    map.fitBounds(imageBounds, {
      padding: FIT_BOUNDS_PADDING,
      animate: false,
    });
    map.setMinZoom(map.getZoom() - 0.5);
    syncProjectedDots();
  }, [imageBounds, map]);

  useEffect(() => {
    syncProjectedDots();
  }, [visibleDots]);

  return null;
}

function clampTooltipPosition(value, min, max) {
  if (max <= min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function MonitoringMapStage({
  allValues,
  imageCalibration,
  imageBounds,
  legendItems,
  loadState,
  mapMessage,
  selectedCategory,
  selectedValue,
  visibleDots,
}) {
  const [hoveredDotId, setHoveredDotId] = useState(null);
  const [selectedDotId, setSelectedDotId] = useState(null);
  const [viewportState, setViewportState] = useState({
    width: 0,
    height: 0,
    projectedDots: [],
  });

  const resolvedCalibration = imageCalibration ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION;
  const resolvedImageBounds = imageBounds ?? DEFAULT_IMAGE_BOUNDS;

  useEffect(() => {
    const visibleIds = new Set(visibleDots.map((dot) => dot.id));

    if (hoveredDotId !== null && !visibleIds.has(hoveredDotId)) {
      setHoveredDotId(null);
    }

    if (selectedDotId !== null && !visibleIds.has(selectedDotId)) {
      setSelectedDotId(null);
    }
  }, [hoveredDotId, selectedDotId, visibleDots]);

  useEffect(() => {
    const projectedVisibleIds = new Set(
      viewportState.projectedDots
        .filter((dot) => dot.isVisibleOnViewport)
        .map((dot) => dot.id),
    );

    if (hoveredDotId !== null && !projectedVisibleIds.has(hoveredDotId)) {
      setHoveredDotId(null);
    }
  }, [hoveredDotId, viewportState.projectedDots]);

  const projectedDots = viewportState.projectedDots.filter((dot) => dot.isVisibleOnViewport);
  const hoveredDot = projectedDots.find((dot) => dot.id === hoveredDotId) ?? null;
  const selectedDot = visibleDots.find((dot) => dot.id === selectedDotId) ?? null;

  const tooltipLeft = hoveredDot
    ? clampTooltipPosition(hoveredDot.leftPx + 18, 16, viewportState.width - 220)
    : 16;
  const tooltipTop = hoveredDot
    ? clampTooltipPosition(hoveredDot.topPx - 112, 16, viewportState.height - 120)
    : 16;

  return (
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
                selectedValue === allValues
                  ? ""
                  : selectedValue === item.value
                    ? "legend-chip--active"
                    : "legend-chip--muted"
              }`}
              key={item.value}
            >
              <span
                className={`legend-swatch ${item.legendClassName ?? ""}`}
                style={
                  item.color
                    ? {
                        background: item.color,
                        color: item.color,
                      }
                    : undefined
                }
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="map-viewport">
        <div className="map-viewport__leaflet-shell">
          <MapContainer
            attributionControl={false}
            bounds={resolvedImageBounds}
            boundsOptions={{ padding: FIT_BOUNDS_PADDING }}
            className="map-leaflet"
            maxBounds={resolvedImageBounds}
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
            <MapViewportBridge
              imageBounds={resolvedImageBounds}
              onViewportSync={setViewportState}
              visibleDots={visibleDots}
            />
          </MapContainer>

          <div className="map-viewport__scrim" />
          <div className="map-viewport__grid" />

          <div className="map-dot-layer">
            {projectedDots.map((dot) => {
              const presentation = dot[selectedCategory];
              const isSelected = selectedDotId === dot.id;
              const isHovered = hoveredDotId === dot.id;

              return (
                <span
                  className={`map-dot ${presentation.dotClassName ?? ""} ${
                    isSelected ? "map-dot--selected" : ""
                  } ${isHovered ? "map-dot--hovered" : ""}`}
                  key={dot.id}
                  style={{
                    ...(presentation.color
                      ? {
                          background: presentation.color,
                          color: presentation.color,
                        }
                      : {}),
                    left: `${dot.leftPx}px`,
                    top: `${dot.topPx}px`,
                  }}
                  aria-label={`${dot.treeIdDisplay}, ${dot.plantName}, ${dot.plantType.label}, ${dot.condition.label}`}
                  onMouseEnter={() => setHoveredDotId(dot.id)}
                  onMouseLeave={() => setHoveredDotId(null)}
                  onFocus={() => setHoveredDotId(dot.id)}
                  onBlur={() => setHoveredDotId(null)}
                  onClick={() => setSelectedDotId(dot.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDotId(dot.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                />
              );
            })}

            <div className="map-overlay map-overlay--center">
              <div className="focus-ring" />
            </div>

            {hoveredDot ? (
              <div
                className="map-tooltip"
                style={{
                  left: `${tooltipLeft}px`,
                  top: `${tooltipTop}px`,
                }}
              >
                <p className="overlay-label">Hover Preview</p>
                <strong>{hoveredDot.treeIdDisplay}</strong>
                <span>{hoveredDot.plantName}</span>
                <span>Jenis: {hoveredDot.plantType.label}</span>
                <span>Kondisi: {hoveredDot.condition.label}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="map-overlay map-overlay--top-left">
          <p className="overlay-label">Map Status</p>
          <strong>{loadState === "ready" ? "Leaflet overlay ready" : "Map shell active"}</strong>
          <span>
            {selectedCategory === "plantType"
              ? "Color mode: Jenis Tumbuhan"
              : "Color mode: Kondisi"}
          </span>
        </div>

        <div className="map-overlay map-overlay--bottom-right">
          <p className="overlay-label">Visible Dots</p>
          <strong>{visibleDots.length} Trees</strong>
          <span>{mapMessage}</span>
        </div>

        <div className="map-overlay map-overlay--bottom-left">
          <p className="overlay-label">Selection</p>
          {selectedDot ? (
            <>
              <strong>{selectedDot.treeIdDisplay}</strong>
              <span>{selectedDot.plantName}</span>
              <span>{selectedDot.plantType.label}</span>
              <span>{selectedDot.condition.label}</span>
            </>
          ) : (
            <>
              <strong>No tree selected</strong>
              <span>Click a dot to pin it in the workspace.</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
