const GARDEN_SCOPE = 3;
const EDGE_PADDING_PERCENT = 5;

const plantTypePresentation = {
  7: { dotClassName: "map-dot--cyan" },
  8: { dotClassName: "map-dot--amber" },
  9: { dotClassName: "map-dot--green" },
};

function clampPercent(value) {
  return Math.min(100 - EDGE_PADDING_PERCENT, Math.max(EDGE_PADDING_PERCENT, value));
}

function projectDotPosition(plant, bounds) {
  const latRange = bounds.max_latitude - bounds.min_latitude;
  const lngRange = bounds.max_longitude - bounds.min_longitude;

  const normalizedX = lngRange === 0 ? 0.5 : (plant.longitude - bounds.min_longitude) / lngRange;
  const normalizedY = latRange === 0 ? 0.5 : (bounds.max_latitude - plant.latitude) / latRange;

  const leftPercent = EDGE_PADDING_PERCENT + normalizedX * (100 - EDGE_PADDING_PERCENT * 2);
  const topPercent = EDGE_PADDING_PERCENT + normalizedY * (100 - EDGE_PADDING_PERCENT * 2);

  return {
    leftPercent: clampPercent(leftPercent),
    topPercent: clampPercent(topPercent),
  };
}

function normalizeSnapshot(payload) {
  const bounds = payload?.meta?.bounds_hint;
  const plants = Array.isArray(payload?.plants) ? payload.plants : [];

  if (!bounds) {
    throw new Error("Missing bounds_hint in synthetic layout payload");
  }

  const scopedPlants = plants.filter(
    (plant) =>
      plant.garden_id === GARDEN_SCOPE &&
      typeof plant.latitude === "number" &&
      typeof plant.longitude === "number",
  );

  const dots = scopedPlants.map((plant) => {
    const position = projectDotPosition(plant, bounds);
    const presentation = plantTypePresentation[plant.plant_type_id] ?? {
      dotClassName: "map-dot--neutral",
    };

    return {
      id: plant.id,
      treeIdDisplay: plant.tree_id_display,
      plantName: plant.plant_name,
      dotClassName: presentation.dotClassName,
      ...position,
    };
  });

  return {
    totalTrees: dots.length,
    dots,
  };
}

export async function loadMonitoringMapSnapshot() {
  const response = await fetch("/garden3_synthetic_latlng.json");

  if (!response.ok) {
    throw new Error(`Failed to load monitoring map snapshot: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeSnapshot(payload);
}
