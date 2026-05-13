const GARDEN_SCOPE = 3;
const EDGE_PADDING_PERCENT = 5;

const plantTypePresentation = {
  7: {
    value: "Musangking",
    label: "Musangking",
    dotClassName: "map-dot--cyan",
    legendClassName: "legend-swatch--cyan",
  },
  8: {
    value: "Duri Hitam",
    label: "Duri Hitam",
    dotClassName: "map-dot--amber",
    legendClassName: "legend-swatch--amber",
  },
  9: {
    value: "Bawor",
    label: "Bawor",
    dotClassName: "map-dot--green",
    legendClassName: "legend-swatch--green",
  },
};

const conditionPresentation = {
  Baik: {
    value: "Baik",
    label: "Baik",
    dotClassName: "map-dot--green",
    legendClassName: "legend-swatch--green",
    badgeClassName: "status-badge--green",
  },
  "Perlu Cek": {
    value: "Perlu Cek",
    label: "Perlu Cek",
    dotClassName: "map-dot--amber",
    legendClassName: "legend-swatch--amber",
    badgeClassName: "status-badge--amber",
  },
  Buruk: {
    value: "Buruk",
    label: "Buruk",
    dotClassName: "map-dot--red",
    legendClassName: "legend-swatch--red",
    badgeClassName: "status-badge--red",
  },
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

function deriveSyntheticCondition(plant) {
  if (plant.layout_row <= 2) {
    return conditionPresentation.Baik;
  }

  if (plant.layout_row <= 4) {
    return conditionPresentation["Perlu Cek"];
  }

  return conditionPresentation.Buruk;
}

function buildFilterOptions(dots, attributeKey) {
  const uniqueValues = new Map();

  dots.forEach((dot) => {
    const attribute = dot[attributeKey];

    if (!uniqueValues.has(attribute.value)) {
      uniqueValues.set(attribute.value, {
        value: attribute.value,
        label: attribute.label,
        dotClassName: attribute.dotClassName,
        legendClassName: attribute.legendClassName,
      });
    }
  });

  return Array.from(uniqueValues.values());
}

function deriveSyntheticNote(plantType, condition, plant) {
  if (condition.value === "Baik") {
    return `${plantType.label} block stable, routine observation complete for ${plant.plant_name}.`;
  }

  if (condition.value === "Perlu Cek") {
    return `Check canopy response and branch health near ${plant.plant_name}.`;
  }

  return `Inspect leaf stress and root-zone moisture around ${plant.plant_name}.`;
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
    const plantType =
      plantTypePresentation[plant.plant_type_id] ?? {
        value: "Unknown",
        label: "Unknown",
        dotClassName: "map-dot--neutral",
        legendClassName: "legend-swatch--neutral",
      };
    const condition = deriveSyntheticCondition(plant);

    return {
      id: plant.id,
      treeIdDisplay: plant.tree_id_display,
      plantName: plant.plant_name,
      plantType,
      condition,
      latitude: plant.latitude,
      longitude: plant.longitude,
      ...position,
    };
  });

  const reportRows = dots.map((dot) => ({
    treeId: dot.treeIdDisplay,
    plantName: dot.plantName,
    jenis: dot.plantType.label,
    kondisi: dot.condition.label,
    badgeClass: dot.condition.badgeClassName,
    note: deriveSyntheticNote(dot.plantType, dot.condition, { plant_name: dot.plantName }),
    updatedAt: dot.id >= 33 ? "2026-02-15" : "2026-02-14",
  }));

  return {
    totalTrees: dots.length,
    dots,
    reportRows,
    mapBounds: [
      [bounds.min_latitude, bounds.min_longitude],
      [bounds.max_latitude, bounds.max_longitude],
    ],
    filters: {
      plantType: buildFilterOptions(dots, "plantType"),
      condition: buildFilterOptions(dots, "condition"),
    },
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
