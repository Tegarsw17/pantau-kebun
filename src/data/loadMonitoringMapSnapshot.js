import {
  fetchConditions,
  fetchGardenPlants,
  fetchPlantTypes,
  fetchPlantUpdates,
  isAdminSupabaseConfigured,
} from "./adminOrchardSupabase.js";
import {
  loadGarden3DroneCalibration,
  projectLayoutPointToCalibration,
} from "./loadDroneCalibration.js";

const GARDEN_SCOPE = 3;
const GARDEN_NAME = "Kebun Ntak-Ntak";
const NO_REPORT_NOTE = "No field report submitted yet.";
const NO_REPORT_UPDATED_AT = "No report yet";
const UNKNOWN_PLANT_TYPE_COLOR = "#94a3b8";
const UNKNOWN_PLANT_NAME = "Unknown Plant";
const REPORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

const STATIC_PLANT_TYPES = {
  7: {
    color: "#3ce6ff",
    label: "Musangking",
  },
  8: {
    color: "#ffca5f",
    label: "Duri Hitam",
  },
  9: {
    color: "#57f287",
    label: "Bawor",
  },
};

const STATIC_CONDITIONS = {
  Healthy: {
    color: "#10B981",
    icon: "✅",
    label: "Healthy",
  },
  "Needs Treatment": {
    color: "#F59E0B",
    icon: "💊",
    label: "Needs Treatment",
  },
  Dead: {
    color: "#EF4444",
    icon: "❌",
    label: "Dead",
  },
};

function formatTreeId(id) {
  return `G03-P${String(id).padStart(6, "0")}`;
}

function normalizeColor(value, fallbackColor) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedValue) ? normalizedValue : fallbackColor;
}

function colorToRgbComponents(color) {
  const normalizedColor = normalizeColor(color, "#64748b").slice(1);
  const expandedColor =
    normalizedColor.length === 3
      ? normalizedColor
          .split("")
          .map((character) => character + character)
          .join("")
      : normalizedColor;

  return {
    blue: Number.parseInt(expandedColor.slice(4, 6), 16),
    green: Number.parseInt(expandedColor.slice(2, 4), 16),
    red: Number.parseInt(expandedColor.slice(0, 2), 16),
  };
}

function buildAlphaColor(color, alpha) {
  const { blue, green, red } = colorToRgbComponents(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildBadgeStyle(color) {
  return {
    backgroundColor: buildAlphaColor(color, 0.2),
    borderColor: color,
    color,
  };
}

function buildPlantTypePresentation({ color, label }) {
  const resolvedColor = normalizeColor(color, UNKNOWN_PLANT_TYPE_COLOR);
  return {
    color: resolvedColor,
    label,
    value: label,
  };
}

function buildConditionPresentation({ color, icon, label }) {
  const resolvedColor = normalizeColor(color, STATIC_CONDITIONS.Healthy.color);
  return {
    badgeStyle: buildBadgeStyle(resolvedColor),
    color: resolvedColor,
    icon:
      typeof icon === "string" && icon.trim() !== "" ? icon.trim() : STATIC_CONDITIONS.Healthy.icon,
    label,
    value: label,
  };
}

const DEFAULT_PLANT_TYPE_PRESENTATION = buildPlantTypePresentation({
  color: UNKNOWN_PLANT_TYPE_COLOR,
  label: "Unknown",
});

const DEFAULT_CONDITION_PRESENTATION = buildConditionPresentation(STATIC_CONDITIONS.Healthy);

function deriveStaticConditionFromLayout(plant) {
  if (plant.layout_row <= 2) {
    return buildConditionPresentation(STATIC_CONDITIONS.Healthy);
  }

  if (plant.layout_row <= 4) {
    return buildConditionPresentation(STATIC_CONDITIONS["Needs Treatment"]);
  }

  return buildConditionPresentation(STATIC_CONDITIONS.Dead);
}

function buildFilterOptions(dots, attributeKey) {
  const uniqueValues = new Map();

  dots.forEach((dot) => {
    const attribute = dot[attributeKey];

    if (!uniqueValues.has(attribute.value)) {
      uniqueValues.set(attribute.value, {
        color: attribute.color,
        icon: attribute.icon ?? null,
        label: attribute.label,
        value: attribute.value,
      });
    }
  });

  return Array.from(uniqueValues.values());
}

function deriveSyntheticNote(plantType, condition, plant) {
  if (condition.value === "Healthy") {
    return `${plantType.label} block stable, routine observation complete for ${plant.plant_name}.`;
  }

  if (condition.value === "Needs Treatment") {
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

function buildStaticPlantTypeLookup() {
  const lookup = new Map();

  Object.entries(STATIC_PLANT_TYPES).forEach(([plantTypeId, presentation]) => {
    lookup.set(Number(plantTypeId), buildPlantTypePresentation(presentation));
  });

  return lookup;
}

function buildPlantTypeLookup(plantTypes) {
  const lookup = new Map();

  (Array.isArray(plantTypes) ? plantTypes : []).forEach((plantType) => {
    const numericId = Number(plantType?.id);

    if (!Number.isFinite(numericId)) {
      return;
    }

    const staticPresentation = STATIC_PLANT_TYPES[numericId];
    lookup.set(
      numericId,
      buildPlantTypePresentation({
        color: plantType?.color ?? UNKNOWN_PLANT_TYPE_COLOR,
        label:
          typeof plantType?.name === "string" && plantType.name.trim() !== ""
            ? plantType.name.trim()
            : staticPresentation?.label ?? DEFAULT_PLANT_TYPE_PRESENTATION.label,
      }),
    );
  });

  return lookup;
}

function buildConditionLookup(conditions) {
  const lookup = new Map();

  (Array.isArray(conditions) ? conditions : []).forEach((condition) => {
    const numericId = Number(condition?.id);

    if (!Number.isFinite(numericId) || condition?.is_active === false) {
      return;
    }

    lookup.set(
      numericId,
      buildConditionPresentation({
        color: condition?.color ?? STATIC_CONDITIONS.Healthy.color,
        icon: condition?.icon ?? STATIC_CONDITIONS.Healthy.icon,
        label:
          typeof condition?.name === "string" && condition.name.trim() !== ""
            ? condition.name.trim()
            : STATIC_CONDITIONS.Healthy.label,
      }),
    );
  });

  return lookup;
}

function resolveDefaultConditionPresentation(conditionLookup) {
  const defaultCondition = Array.from(conditionLookup.values()).find((condition) =>
    ["baik", "healthy"].includes(normalizeReferenceValue(condition.label)),
  );

  return defaultCondition ?? DEFAULT_CONDITION_PRESENTATION;
}

function normalizeReferenceValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

function normalizeConditionIds(conditionIds) {
  if (!Array.isArray(conditionIds)) {
    return [];
  }

  return conditionIds
    .map((conditionId) => Number(conditionId))
    .filter((conditionId) => Number.isFinite(conditionId));
}

function buildPlantReferenceIndex(plants) {
  const plantById = new Map();
  const plantByReference = new Map();

  (Array.isArray(plants) ? plants : []).forEach((plant) => {
    const plantId = String(plant.id);
    plantById.set(plantId, plant);

    const referenceKeys = [
      plantId,
      typeof plant?.plant_name === "string" ? plant.plant_name : "",
      typeof plant?.tree_id_display === "string" ? plant.tree_id_display : "",
    ];

    referenceKeys.forEach((referenceKey) => {
      const normalizedReference = normalizeReferenceValue(referenceKey);

      if (normalizedReference !== "" && !plantByReference.has(normalizedReference)) {
        plantByReference.set(normalizedReference, plant);
      }
    });
  });

  return {
    plantById,
    plantByReference,
  };
}

function resolvePlantFromReference(plantReferenceIndex, referenceValue) {
  const normalizedReference = normalizeReferenceValue(referenceValue);

  if (normalizedReference === "") {
    return null;
  }

  return plantReferenceIndex.plantByReference.get(normalizedReference) ?? null;
}

function buildLatestUpdateByPlantId(updates, plantReferenceIndex) {
  const latestUpdateByPlantId = new Map();

  (Array.isArray(updates) ? updates : []).forEach((update) => {
    const plant = resolvePlantFromReference(plantReferenceIndex, update?.plant_id);

    if (plant == null) {
      return;
    }

    const plantId = String(plant.id);

    if (latestUpdateByPlantId.has(plantId)) {
      return;
    }

    latestUpdateByPlantId.set(plantId, update);
  });

  return latestUpdateByPlantId;
}

function buildLayoutMetadataByPlantId(payload) {
  const layoutByPlantId = new Map();
  const plants = Array.isArray(payload?.plants) ? payload.plants : [];

  plants.forEach((plant) => {
    layoutByPlantId.set(String(plant.id), {
      layout_col: typeof plant.layout_col === "number" ? plant.layout_col : null,
      layout_row: typeof plant.layout_row === "number" ? plant.layout_row : null,
      tree_id_display:
        typeof plant.tree_id_display === "string" && plant.tree_id_display.trim() !== ""
          ? plant.tree_id_display.trim()
          : formatTreeId(plant.id),
      x_m: typeof plant.x_m === "number" ? plant.x_m : null,
      y_m: typeof plant.y_m === "number" ? plant.y_m : null,
    });
  });

  return layoutByPlantId;
}

function mergePlantWithLayout(plant, layoutByPlantId) {
  const layoutMetadata = layoutByPlantId.get(String(plant.id));

  return {
    ...plant,
    layout_col: layoutMetadata?.layout_col ?? null,
    layout_row: layoutMetadata?.layout_row ?? null,
    tree_id_display: layoutMetadata?.tree_id_display ?? formatTreeId(plant.id),
    x_m: layoutMetadata?.x_m ?? null,
    y_m: layoutMetadata?.y_m ?? null,
  };
}

function resolvePlantType(plant, plantTypeLookup) {
  return plantTypeLookup.get(Number(plant.plant_type_id)) ?? DEFAULT_PLANT_TYPE_PRESENTATION;
}

function resolveCondition(latestUpdate, conditionLookup) {
  const conditionIds = normalizeConditionIds(latestUpdate?.condition_ids);

  for (const conditionId of conditionIds) {
    const condition = conditionLookup.get(conditionId);

    if (condition != null) {
      return condition;
    }
  }

  return resolveDefaultConditionPresentation(conditionLookup);
}

function resolveLatestNote(latestUpdate) {
  const note = typeof latestUpdate?.desc === "string" ? latestUpdate.desc.trim() : "";
  return note !== "" ? note : NO_REPORT_NOTE;
}

function formatUpdatedAt(latestUpdate) {
  const createdAt = typeof latestUpdate?.created_at === "string" ? latestUpdate.created_at.trim() : "";

  if (createdAt !== "") {
    const parsedDate = new Date(createdAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      return REPORT_DATE_FORMATTER.format(parsedDate);
    }
  }

  const fallbackDate = typeof latestUpdate?.date === "string" ? latestUpdate.date.trim() : "";
  return fallbackDate !== "" ? fallbackDate : NO_REPORT_UPDATED_AT;
}

function resolvePlantLatLng(plant, calibration, layoutExtent) {
  if (typeof plant.latitude === "number" && typeof plant.longitude === "number") {
    return {
      coordinateSource: "supabase",
      lat: plant.latitude,
      lng: plant.longitude,
    };
  }

  if (typeof plant.x_m === "number" && typeof plant.y_m === "number") {
    const projectedPoint = projectLayoutPointToCalibration(
      {
        x: plant.x_m,
        y: plant.y_m,
      },
      layoutExtent,
      calibration,
    );

    return {
      coordinateSource: "layout",
      lat: projectedPoint.lat,
      lng: projectedPoint.lng,
    };
  }

  return null;
}

function buildDotRecord({ condition, plant, plantType, resolvedLatLng }) {
  return {
    condition,
    coordinateSource: resolvedLatLng.coordinateSource,
    id: plant.id,
    latitude: resolvedLatLng.lat,
    layoutPosition: {
      x: typeof plant.x_m === "number" ? plant.x_m : null,
      y: typeof plant.y_m === "number" ? plant.y_m : null,
    },
    longitude: resolvedLatLng.lng,
    plantName: plant.plant_name,
    plantType,
    treeIdDisplay: plant.tree_id_display,
  };
}

function buildUpdateReportRows({ conditionLookup, plantReferenceIndex, plantTypeLookup, updates }) {
  return (Array.isArray(updates) ? updates : []).map((update) => {
    const plantId = String(update?.plant_id ?? "").trim();
    const plant = resolvePlantFromReference(plantReferenceIndex, plantId);
    const plantType =
      plant != null
        ? resolvePlantType(plant, plantTypeLookup)
        : buildPlantTypePresentation({
            color: UNKNOWN_PLANT_TYPE_COLOR,
            label:
              typeof update?.type === "string" && update.type.trim() !== ""
                ? update.type.trim()
                : "Unknown",
          });
    const condition = resolveCondition(update, conditionLookup);
    const numericPlantId = Number(plantId);

    return {
      id:
        update?.id ??
        `${plantId !== "" ? plantId : "unknown"}-${update?.created_at ?? update?.date ?? "report"}`,
      badgeStyle: condition.badgeStyle,
      conditionIcon: condition.icon,
      kondisi: condition.label,
      jenis: plantType.label,
      note: resolveLatestNote(update),
      plantName: plant?.plant_name ?? (plantId || UNKNOWN_PLANT_NAME),
      treeId:
        plant?.tree_id_display ??
        (Number.isFinite(numericPlantId) ? formatTreeId(numericPlantId) : plantId || "Unknown"),
      updatedAt: formatUpdatedAt(update),
    };
  });
}

function buildStaticSnapshot(payload, calibration) {
  const plants = Array.isArray(payload?.plants) ? payload.plants : [];
  const scopedPlants = plants.filter((plant) => plant.garden_id === GARDEN_SCOPE);
  const layoutExtent = deriveLayoutExtent(scopedPlants);
  const plantTypeLookup = buildStaticPlantTypeLookup();

  const dots = scopedPlants.map((plant) => {
    const plantType = resolvePlantType(plant, plantTypeLookup);
    const condition = deriveStaticConditionFromLayout(plant);
    const resolvedLatLng =
      typeof plant.x_m === "number" && typeof plant.y_m === "number"
        ? projectLayoutPointToCalibration(
            {
              x: plant.x_m,
              y: plant.y_m,
            },
            layoutExtent,
            calibration,
          )
        : {
            lat: plant.latitude,
            lng: plant.longitude,
          };

    return {
      condition,
      id: plant.id,
      latitude: resolvedLatLng.lat,
      layoutPosition: {
        x: typeof plant.x_m === "number" ? plant.x_m : null,
        y: typeof plant.y_m === "number" ? plant.y_m : null,
      },
      longitude: resolvedLatLng.lng,
      plantName: plant.plant_name,
      plantType,
      treeIdDisplay: plant.tree_id_display,
    };
  });

  const reportRows = scopedPlants.map((plant) => {
    const plantType = resolvePlantType(plant, plantTypeLookup);
    const condition = deriveStaticConditionFromLayout(plant);

    return {
      id: plant.id,
      badgeStyle: condition.badgeStyle,
      conditionIcon: condition.icon,
      kondisi: condition.label,
      jenis: plantType.label,
      note: deriveSyntheticNote(plantType, condition, plant),
      plantName: plant.plant_name,
      treeId: plant.tree_id_display,
      updatedAt: plant.id >= 33 ? "15 Feb 2026" : "14 Feb 2026",
    };
  });

  return {
    dots,
    filters: {
      condition: buildFilterOptions(dots, "condition"),
      plantType: buildFilterOptions(dots, "plantType"),
    },
    imageCalibration: calibration,
    mapBounds: calibration.mapBounds,
    message: "Static orchard preview loaded.",
    reportRows,
    totalTrees: scopedPlants.length,
  };
}

function buildSupabaseSnapshot({ calibration, conditions, layoutPayload, plantTypes, plants, updates }) {
  const layoutByPlantId = buildLayoutMetadataByPlantId(layoutPayload);
  const scopedPlants = (Array.isArray(plants) ? plants : [])
    .filter((plant) => plant.garden_id === GARDEN_SCOPE)
    .map((plant) => mergePlantWithLayout(plant, layoutByPlantId));
  const layoutExtent = deriveLayoutExtent(scopedPlants);
  const plantTypeLookup = buildPlantTypeLookup(plantTypes);
  const conditionLookup = buildConditionLookup(conditions);
  const plantReferenceIndex = buildPlantReferenceIndex(scopedPlants);
  const latestUpdateByPlantId = buildLatestUpdateByPlantId(updates, plantReferenceIndex);
  const dots = [];
  const reportRows = buildUpdateReportRows({
    conditionLookup,
    plantReferenceIndex,
    plantTypeLookup,
    updates,
  });

  scopedPlants.forEach((plant) => {
    const plantType = resolvePlantType(plant, plantTypeLookup);
    const latestUpdate = latestUpdateByPlantId.get(String(plant.id)) ?? null;
    const condition = resolveCondition(latestUpdate, conditionLookup);
    const resolvedLatLng = resolvePlantLatLng(plant, calibration, layoutExtent);

    if (resolvedLatLng != null) {
      dots.push(
        buildDotRecord({
          condition,
          plant,
          plantType,
          resolvedLatLng,
        }),
      );
    }
  });
  const previewLayoutCount = dots.filter((dot) => dot.coordinateSource === "layout").length;

  return {
    dots,
    filters: {
      condition: buildFilterOptions(dots, "condition"),
      plantType: buildFilterOptions(dots, "plantType"),
    },
    imageCalibration: calibration,
    mapBounds: calibration.mapBounds,
    message:
      previewLayoutCount > 0
        ? `Supabase orchard snapshot loaded. ${previewLayoutCount} trees still use preview layout.`
        : "Supabase orchard snapshot loaded.",
    reportRows,
    totalTrees: scopedPlants.length,
  };
}

async function loadStaticLayoutPayload() {
  const response = await fetch("/garden3_synthetic_latlng.json");

  if (!response.ok) {
    throw new Error(`Failed to load monitoring map snapshot: ${response.status}`);
  }

  return response.json();
}

export async function loadMonitoringMapSnapshot() {
  const [calibration, layoutPayload] = await Promise.all([
    loadGarden3DroneCalibration(),
    loadStaticLayoutPayload().catch(() => null),
  ]);

  if (isAdminSupabaseConfigured()) {
    try {
      const [plants, plantTypes, conditions, updates] = await Promise.all([
        fetchGardenPlants(GARDEN_SCOPE),
        fetchPlantTypes(),
        fetchConditions(),
        fetchPlantUpdates(GARDEN_NAME),
      ]);

      return buildSupabaseSnapshot({
        calibration,
        conditions,
        layoutPayload,
        plantTypes,
        plants,
        updates,
      });
    } catch {
      if (layoutPayload != null) {
        const staticSnapshot = buildStaticSnapshot(layoutPayload, calibration);
        return {
          ...staticSnapshot,
          message: "Supabase monitoring data unavailable. Static orchard preview loaded.",
        };
      }

      throw new Error("Failed to load monitoring map snapshot from Supabase.");
    }
  }

  if (layoutPayload == null) {
    throw new Error("Failed to load monitoring map snapshot.");
  }

  return buildStaticSnapshot(layoutPayload, calibration);
}
