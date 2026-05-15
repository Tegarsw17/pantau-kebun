const DRONE_CALIBRATION_URL = "/garden3_drone_calibration.json";
const DEFAULT_IMAGE_URL = "/dronentak.jpeg";
const DEFAULT_PADDING_RATIO = 0.06;
const LAYOUT_EDGE_INSET_RATIO = 0.08;

const DEFAULT_GARDEN_3_CORNERS = {
  northWest: {
    lat: -7.006962,
    lng: 109.601791,
  },
  northEast: {
    lat: -7.006951,
    lng: 109.602754,
  },
  southEast: {
    lat: -7.008749,
    lng: 109.60314,
  },
  southWest: {
    lat: -7.008866,
    lng: 109.602091,
  },
};

function normalizePoint(point, fallbackPoint) {
  const latitude = Number(point?.lat ?? point?.latitude ?? fallbackPoint.lat);
  const longitude = Number(point?.lng ?? point?.longitude ?? fallbackPoint.lng);

  return {
    lat: Number.isFinite(latitude) ? latitude : fallbackPoint.lat,
    lng: Number.isFinite(longitude) ? longitude : fallbackPoint.lng,
  };
}

export function buildBoundsFromCorners(corners, paddingRatio = DEFAULT_PADDING_RATIO) {
  const latitudes = corners.map((corner) => corner.lat);
  const longitudes = corners.map((corner) => corner.lng);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.000001);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.000001);
  const latitudePadding = latitudeRange * paddingRatio;
  const longitudePadding = longitudeRange * paddingRatio;

  return [
    [minLatitude - latitudePadding, minLongitude - longitudePadding],
    [maxLatitude + latitudePadding, maxLongitude + longitudePadding],
  ];
}

export function projectNormalizedPointToCorners(corners, normalizedX, normalizedY) {
  const clampedX = Math.min(1, Math.max(0, normalizedX));
  const clampedY = Math.min(1, Math.max(0, normalizedY));
  const [northWest, northEast, southEast, southWest] = corners;
  const northWeight = 1 - clampedY;
  const southWeight = clampedY;
  const westWeight = 1 - clampedX;
  const eastWeight = clampedX;

  return {
    lat:
      northWest.lat * westWeight * northWeight +
      northEast.lat * eastWeight * northWeight +
      southEast.lat * eastWeight * southWeight +
      southWest.lat * westWeight * southWeight,
    lng:
      northWest.lng * westWeight * northWeight +
      northEast.lng * eastWeight * northWeight +
      southEast.lng * eastWeight * southWeight +
      southWest.lng * westWeight * southWeight,
  };
}

export function projectLayoutPointToCalibration(layoutPoint, layoutExtent, corners) {
  const xRange = Math.max(layoutExtent.maxX - layoutExtent.minX, 1);
  const yRange = Math.max(layoutExtent.maxY - layoutExtent.minY, 1);
  const normalizedX =
    LAYOUT_EDGE_INSET_RATIO +
    ((layoutPoint.x - layoutExtent.minX) / xRange) * (1 - LAYOUT_EDGE_INSET_RATIO * 2);
  const normalizedY =
    LAYOUT_EDGE_INSET_RATIO +
    ((layoutPoint.y - layoutExtent.minY) / yRange) * (1 - LAYOUT_EDGE_INSET_RATIO * 2);

  return projectNormalizedPointToCorners(corners, normalizedX, normalizedY);
}

function normalizeCalibration(payload) {
  const payloadCorners = payload?.corners ?? {};
  const northWest = normalizePoint(payloadCorners.northWest, DEFAULT_GARDEN_3_CORNERS.northWest);
  const northEast = normalizePoint(payloadCorners.northEast, DEFAULT_GARDEN_3_CORNERS.northEast);
  const southEast = normalizePoint(payloadCorners.southEast, DEFAULT_GARDEN_3_CORNERS.southEast);
  const southWest = normalizePoint(payloadCorners.southWest, DEFAULT_GARDEN_3_CORNERS.southWest);
  const corners = [northWest, northEast, southEast, southWest];

  return {
    anchorQuality: payload?.anchor_quality ?? "approximate",
    confidenceNote:
      payload?.confidence_note ??
      "Initial four-corner calibration is active and can be refined later in admin.",
    corners,
    gardenId: payload?.garden_id ?? 3,
    imageUrl:
      typeof payload?.image_url === "string" && payload.image_url.trim() !== ""
        ? payload.image_url.trim()
        : DEFAULT_IMAGE_URL,
    mapBounds: buildBoundsFromCorners(corners),
    notes: Array.isArray(payload?.notes) ? payload.notes : [],
  };
}

export const DEFAULT_GARDEN_3_DRONE_CALIBRATION = normalizeCalibration({
  corners: DEFAULT_GARDEN_3_CORNERS,
  garden_id: 3,
  image_url: DEFAULT_IMAGE_URL,
});

export async function loadGarden3DroneCalibration() {
  const response = await fetch(DRONE_CALIBRATION_URL);

  if (!response.ok) {
    return DEFAULT_GARDEN_3_DRONE_CALIBRATION;
  }

  const payload = await response.json();
  return normalizeCalibration(payload);
}
