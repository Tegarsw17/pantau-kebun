import { loadMonitoringMapSnapshot } from "./loadMonitoringMapSnapshot.js";
import {
  fetchAdminMappedPlants,
  fetchAdminUnmappedPlants,
  fetchPlantTypes,
  getAdminPersistenceMode,
  isAdminSupabaseConfigured,
} from "./adminOrchardSupabase.js";

const PLANT_TYPE_LABELS = {
  7: "Musangking",
  8: "Duri Hitam",
  9: "Bawor",
};
const PLANT_TYPE_COLORS = {
  7: "#3ce6ff",
  8: "#ffca5f",
  9: "#57f287",
};
const DEFAULT_PLANT_TYPE_COLOR = "#94a3b8";

const ADMIN_GARDEN_SCOPE = 3;
const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatTreeId(id) {
  return `G03-P${String(id).padStart(6, "0")}`;
}

function formatCreatedAt(createdAt) {
  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  return CREATED_AT_FORMATTER.format(parsedDate);
}

function buildPlantPresentationById(dots) {
  const mappedDots = Array.isArray(dots) ? dots : [];
  const plantPresentationById = new Map();

  mappedDots.forEach((dot) => {
    plantPresentationById.set(dot.id, {
      plantTypeColor: dot.plantType?.color ?? PLANT_TYPE_COLORS[dot.plantTypeId] ?? "#94a3b8",
      plantTypeLabel: dot.plantType?.label ?? "Unknown",
    });
  });

  return plantPresentationById;
}

function buildPlantTypeById(plantTypes) {
  const plantTypeById = new Map();

  (Array.isArray(plantTypes) ? plantTypes : []).forEach((plantType) => {
    const numericId = Number(plantType?.id);

    if (!Number.isFinite(numericId)) {
      return;
    }

    plantTypeById.set(numericId, {
      plantTypeColor:
        typeof plantType?.color === "string" && plantType.color.trim() !== ""
          ? plantType.color.trim()
          : PLANT_TYPE_COLORS[numericId] ?? DEFAULT_PLANT_TYPE_COLOR,
      plantTypeLabel:
        typeof plantType?.name === "string" && plantType.name.trim() !== ""
          ? plantType.name.trim()
          : PLANT_TYPE_LABELS[numericId] ?? "Unknown",
    });
  });

  return plantTypeById;
}

function resolvePlantPresentation(plant, plantTypeById, plantPresentationById) {
  return (
    plantTypeById.get(Number(plant.plant_type_id)) ??
    plantPresentationById.get(plant.id) ?? {
      plantTypeColor: PLANT_TYPE_COLORS[plant.plant_type_id] ?? DEFAULT_PLANT_TYPE_COLOR,
      plantTypeLabel: PLANT_TYPE_LABELS[plant.plant_type_id] ?? "Unknown",
    }
  );
}

function normalizeUnmappedPlants(payload, plantTypeById, plantPresentationById) {
  const plants = Array.isArray(payload) ? payload : [];

  return plants
    .filter((plant) => plant.garden_id === ADMIN_GARDEN_SCOPE)
    .map((plant) => {
      const plantPresentation = resolvePlantPresentation(plant, plantTypeById, plantPresentationById);

      return {
        id: plant.id,
        treeIdDisplay: formatTreeId(plant.id),
        plantName: plant.plant_name,
        plantTypeColor: plantPresentation.plantTypeColor,
        plantTypeLabel: plantPresentation.plantTypeLabel,
        createdAtLabel: formatCreatedAt(plant.created_at),
      };
    });
}

function normalizeMappedPlants(payload, plantTypeById, plantPresentationById) {
  const plants = Array.isArray(payload) ? payload : [];

  return plants
    .filter(
      (plant) =>
        plant.garden_id === ADMIN_GARDEN_SCOPE &&
        typeof plant.latitude === "number" &&
        typeof plant.longitude === "number",
    )
    .map((plant) => {
      const plantPresentation = resolvePlantPresentation(plant, plantTypeById, plantPresentationById);

      return {
        id: plant.id,
        treeIdDisplay: formatTreeId(plant.id),
        plantName: plant.plant_name,
        plantTypeColor: plantPresentation.plantTypeColor,
        plantTypeLabel: plantPresentation.plantTypeLabel,
        createdAtLabel: formatCreatedAt(plant.created_at),
        latlng: {
          lat: plant.latitude,
          lng: plant.longitude,
        },
      };
    });
}

function normalizeSyntheticMappedTrees(dots) {
  const mappedDots = Array.isArray(dots) ? dots : [];

  return mappedDots.map((dot) => ({
    id: dot.id,
    treeIdDisplay: dot.treeIdDisplay,
    plantName: dot.plantName,
    plantTypeColor: dot.plantType.color,
    plantTypeLabel: dot.plantType.label,
    createdAtLabel: "Preview Seed",
    latlng: {
      lat: dot.latitude,
      lng: dot.longitude,
    },
    layoutPosition: dot.layoutPosition,
  }));
}

export async function loadAdminOrchardWorkspace() {
  const monitoringSnapshot = await loadMonitoringMapSnapshot();
  const plantPresentationById = buildPlantPresentationById(monitoringSnapshot.dots);
  const isSupabaseReady = isAdminSupabaseConfigured();
  const [unmappedPayload, mappedPayload, plantTypes] = isSupabaseReady
    ? await Promise.all([
        fetchAdminUnmappedPlants(ADMIN_GARDEN_SCOPE),
        fetchAdminMappedPlants(ADMIN_GARDEN_SCOPE),
        fetchPlantTypes(),
      ])
    : await Promise.all([
        fetchStaticUnmappedPlants(),
        Promise.resolve(normalizeSyntheticMappedTrees(monitoringSnapshot.dots)),
        Promise.resolve([]),
      ]);
  const plantTypeById = buildPlantTypeById(plantTypes);
  const unmappedTrees = normalizeUnmappedPlants(
    unmappedPayload,
    plantTypeById,
    plantPresentationById,
  );
  const mappedTrees = isSupabaseReady
    ? normalizeMappedPlants(mappedPayload, plantTypeById, plantPresentationById)
    : mappedPayload;

  return {
    dataSource: getAdminPersistenceMode(),
    imageCalibration: monitoringSnapshot.imageCalibration,
    imageBounds: monitoringSnapshot.mapBounds,
    mappedTrees,
    unmappedTrees,
  };
}

async function fetchStaticUnmappedPlants() {
  const unmappedResponse = await fetch("/garden3_unmapped_plants.json");

  if (!unmappedResponse.ok) {
    throw new Error(`Failed to load unmapped plants snapshot: ${unmappedResponse.status}`);
  }

  return unmappedResponse.json();
}
