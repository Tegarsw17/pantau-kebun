import {
  loadGarden3DroneCalibration,
  projectLayoutPointToCalibration,
} from "./loadDroneCalibration.js";

const GARDEN_SCOPE = 3;

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

function deriveLayoutExtent(plants) {
  const xValues = plants.map((plant) => plant.x_m).filter((value) => typeof value === "number");
  const yValues = plants.map((plant) => plant.y_m).filter((value) => typeof value === "number");

  return {
    maxX: xValues.length > 0 ? Math.max(...xValues) : 1,
    maxY: yValues.length > 0 ? Math.max(...yValues) : 1,
    minX: xValues.length > 0 ? Math.min(...xValues) : 0,
    minY: yValues.length > 0 ? Math.min(...yValues) : 0,
  };
}

function normalizeSnapshot(payload, calibration) {
  const plants = Array.isArray(payload?.plants) ? payload.plants : [];

  const scopedPlants = plants.filter((plant) => plant.garden_id === GARDEN_SCOPE);
  const layoutExtent = deriveLayoutExtent(scopedPlants);

  const dots = scopedPlants.map((plant) => {
    const resolvedLatLng =
      typeof plant.x_m === "number" && typeof plant.y_m === "number"
        ? projectLayoutPointToCalibration(
            {
              x: plant.x_m,
              y: plant.y_m,
            },
            layoutExtent,
            calibration.corners,
          )
        : {
            lat: plant.latitude,
            lng: plant.longitude,
          };
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
      latitude: resolvedLatLng.lat,
      longitude: resolvedLatLng.lng,
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
    imageCalibration: calibration,
    totalTrees: dots.length,
    dots,
    reportRows,
    mapBounds: calibration.mapBounds,
    filters: {
      plantType: buildFilterOptions(dots, "plantType"),
      condition: buildFilterOptions(dots, "condition"),
    },
  };
}

export async function loadMonitoringMapSnapshot() {
  const [response, calibration] = await Promise.all([
    fetch("/garden3_synthetic_latlng.json"),
    loadGarden3DroneCalibration(),
  ]);

  if (!response.ok) {
    throw new Error(`Failed to load monitoring map snapshot: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeSnapshot(payload, calibration);
}
