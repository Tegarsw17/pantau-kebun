import { loadMonitoringMapSnapshot } from "./loadMonitoringMapSnapshot.js";
import {
  fetchAdminUnmappedPlants,
  getAdminPersistenceMode,
  isAdminSupabaseConfigured,
} from "./adminOrchardSupabase.js";

const PLANT_TYPE_LABELS = {
  7: "Musangking",
  8: "Duri Hitam",
  9: "Bawor",
};

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

function normalizeUnmappedPlants(payload) {
  const plants = Array.isArray(payload) ? payload : [];

  return plants
    .filter((plant) => plant.garden_id === ADMIN_GARDEN_SCOPE)
    .map((plant) => ({
      id: plant.id,
      treeIdDisplay: formatTreeId(plant.id),
      plantName: plant.plant_name,
      plantTypeLabel: PLANT_TYPE_LABELS[plant.plant_type_id] ?? "Unknown",
      createdAtLabel: formatCreatedAt(plant.created_at),
    }));
}

export async function loadAdminOrchardWorkspace() {
  const monitoringSnapshot = await loadMonitoringMapSnapshot();
  const unmappedPayload = isAdminSupabaseConfigured()
    ? await fetchAdminUnmappedPlants(ADMIN_GARDEN_SCOPE)
    : await fetchStaticUnmappedPlants();
  const unmappedTrees = normalizeUnmappedPlants(unmappedPayload);

  return {
    dataSource: getAdminPersistenceMode(),
    imageBounds: monitoringSnapshot.mapBounds,
    totalUnmappedTrees: unmappedTrees.length,
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
