import { useEffect, useState } from "react";

export function MonitoringMapStage({
  allValues,
  legendItems,
  loadState,
  mapMessage,
  selectedCategory,
  selectedValue,
  visibleDots,
}) {
  const [hoveredDotId, setHoveredDotId] = useState(null);
  const [selectedDotId, setSelectedDotId] = useState(null);

  useEffect(() => {
    const visibleIds = new Set(visibleDots.map((dot) => dot.id));

    if (hoveredDotId !== null && !visibleIds.has(hoveredDotId)) {
      setHoveredDotId(null);
    }

    if (selectedDotId !== null && !visibleIds.has(selectedDotId)) {
      setSelectedDotId(null);
    }
  }, [hoveredDotId, selectedDotId, visibleDots]);

  const hoveredDot = visibleDots.find((dot) => dot.id === hoveredDotId) ?? null;
  const selectedDot = visibleDots.find((dot) => dot.id === selectedDotId) ?? null;

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
              const isSelected = selectedDotId === dot.id;
              const isHovered = hoveredDotId === dot.id;

              return (
                <span
                  className={`map-dot ${presentation.dotClassName} ${
                    isSelected ? "map-dot--selected" : ""
                  } ${isHovered ? "map-dot--hovered" : ""}`}
                  key={dot.id}
                  style={{ left: `${dot.leftPercent}%`, top: `${dot.topPercent}%` }}
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
                  left: `${Math.min(hoveredDot.leftPercent + 3, 82)}%`,
                  top: `${Math.max(hoveredDot.topPercent - 14, 8)}%`,
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
          <strong>{loadState === "ready" ? "JSON map preview ready" : "Map shell active"}</strong>
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
