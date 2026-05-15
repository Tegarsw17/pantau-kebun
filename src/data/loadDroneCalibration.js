import {
  fetchGardenDroneCalibrationRecord,
  isAdminSupabaseConfigured,
} from "./adminOrchardSupabase.js";

const DRONE_CALIBRATION_URL = "/garden3_drone_calibration.json";
const DRONE_CALIBRATION_STORAGE_KEY = "pantaukebun.garden3.drone-calibration";
const DEFAULT_IMAGE_URL = "/dronentak.jpeg";
const DEFAULT_PADDING_RATIO = 0.06;
const EARTH_RADIUS_METERS = 6378137;

const DEFAULT_GARDEN_3_CALIBRATION = {
  anchorQuality: "approximate",
  center: {
    lat: -7.007853,
    lng: 109.602477,
  },
  calibrationMode: "center_heading_size",
  confidenceNote:
    "Initial center-based calibration is active and can be refined later in admin.",
  gardenId: 3,
  headingDegrees: 219,
  imageUrl: DEFAULT_IMAGE_URL,
  layoutOffsetMeters: {
    x: 0,
    y: 0,
  },
  sizeMeters: {
    height: 100,
    width: 300,
  },
};

function normalizeNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function normalizePoint(point, fallbackPoint) {
  const latitude = Number(point?.lat ?? point?.latitude ?? fallbackPoint.lat);
  const longitude = Number(point?.lng ?? point?.longitude ?? fallbackPoint.lng);

  return {
    lat: Number.isFinite(latitude) ? latitude : fallbackPoint.lat,
    lng: Number.isFinite(longitude) ? longitude : fallbackPoint.lng,
  };
}

function normalizeBearingDegrees(value, fallbackValue) {
  const parsedValue = normalizeNumber(value, fallbackValue);
  return ((parsedValue % 360) + 360) % 360;
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

function distanceBetweenPointsMeters(startPoint, endPoint) {
  const startLatitude = (startPoint.lat * Math.PI) / 180;
  const endLatitude = (endPoint.lat * Math.PI) / 180;
  const latitudeDelta = ((endPoint.lat - startPoint.lat) * Math.PI) / 180;
  const longitudeDelta = ((endPoint.lng - startPoint.lng) * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function bearingBetweenPoints(startPoint, endPoint) {
  const startLatitude = (startPoint.lat * Math.PI) / 180;
  const endLatitude = (endPoint.lat * Math.PI) / 180;
  const longitudeDelta = ((endPoint.lng - startPoint.lng) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);

  return normalizeBearingDegrees((Math.atan2(y, x) * 180) / Math.PI, DEFAULT_GARDEN_3_CALIBRATION.headingDegrees);
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

function buildRectangleCornersFromCenterModel(center, headingDegrees, widthMeters, heightMeters) {
  const halfWidth = widthMeters / 2;
  const halfHeight = heightMeters / 2;
  const topHeading = normalizeBearingDegrees(headingDegrees, DEFAULT_GARDEN_3_CALIBRATION.headingDegrees);
  const rightHeading = normalizeBearingDegrees(topHeading + 90, topHeading + 90);
  const leftHeading = normalizeBearingDegrees(topHeading - 90, topHeading - 90);
  const topMidpoint = offsetPointByMeters(center, topHeading, halfHeight);
  const bottomMidpoint = offsetPointByMeters(center, topHeading + 180, halfHeight);

  const topLeft = offsetPointByMeters(topMidpoint, leftHeading, halfWidth);
  const topRight = offsetPointByMeters(topMidpoint, rightHeading, halfWidth);
  const bottomRight = offsetPointByMeters(bottomMidpoint, rightHeading, halfWidth);
  const bottomLeft = offsetPointByMeters(bottomMidpoint, leftHeading, halfWidth);

  return [topLeft, topRight, bottomRight, bottomLeft];
}

export function projectNormalizedPointToCorners(corners, normalizedX, normalizedY) {
  const clampedX = Math.min(1, Math.max(0, normalizedX));
  const clampedY = Math.min(1, Math.max(0, normalizedY));
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const topWeight = 1 - clampedY;
  const bottomWeight = clampedY;
  const leftWeight = 1 - clampedX;
  const rightWeight = clampedX;

  return {
    lat:
      topLeft.lat * leftWeight * topWeight +
      topRight.lat * rightWeight * topWeight +
      bottomRight.lat * rightWeight * bottomWeight +
      bottomLeft.lat * leftWeight * bottomWeight,
    lng:
      topLeft.lng * leftWeight * topWeight +
      topRight.lng * rightWeight * topWeight +
      bottomRight.lng * rightWeight * bottomWeight +
      bottomLeft.lng * leftWeight * bottomWeight,
  };
}

function projectLayoutPointByCenterModel(layoutPoint, layoutExtent, calibration) {
  const centerX = (layoutExtent.minX + layoutExtent.maxX) / 2;
  const centerY = (layoutExtent.minY + layoutExtent.maxY) / 2;
  const offsetXMeters = layoutPoint.x - centerX + (calibration.layoutOffsetMeters?.x ?? 0);
  const offsetYMeters = layoutPoint.y - centerY + (calibration.layoutOffsetMeters?.y ?? 0);
  const topHeading = normalizeBearingDegrees(
    calibration.headingDegrees,
    DEFAULT_GARDEN_3_CALIBRATION.headingDegrees,
  );

  let point = offsetPointByMeters(calibration.center, normalizeBearingDegrees(topHeading + 90, 90), offsetXMeters);
  point = offsetPointByMeters(point, normalizeBearingDegrees(topHeading + 180, 180), offsetYMeters);

  return point;
}

export function projectLayoutPointToCalibration(layoutPoint, layoutExtent, calibration) {
  if (calibration?.calibrationMode === "center_heading_size") {
    return projectLayoutPointByCenterModel(layoutPoint, layoutExtent, calibration);
  }

  const xRange = Math.max(layoutExtent.maxX - layoutExtent.minX, 1);
  const yRange = Math.max(layoutExtent.maxY - layoutExtent.minY, 1);
  const normalizedX = (layoutPoint.x - layoutExtent.minX) / xRange;
  const normalizedY = (layoutPoint.y - layoutExtent.minY) / yRange;

  return projectNormalizedPointToCorners(calibration.corners, normalizedX, normalizedY);
}

function normalizeCalibration(payload) {
  const calibrationMode =
    payload?.calibration_mode ??
    payload?.calibrationMode ??
    (payload?.center != null ? "center_heading_size" : "four_corner");

  if (calibrationMode === "center_heading_size") {
    const center = normalizePoint(payload?.center, DEFAULT_GARDEN_3_CALIBRATION.center);
    const headingDegrees = normalizeBearingDegrees(
      payload?.heading_degrees ?? payload?.headingDegrees,
      DEFAULT_GARDEN_3_CALIBRATION.headingDegrees,
    );
    const widthMeters = normalizeNumber(
      payload?.width_meters ?? payload?.widthMeters,
      DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.width,
    );
    const heightMeters = normalizeNumber(
      payload?.height_meters ?? payload?.heightMeters,
      DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.height,
    );
    const layoutOffsetMeters = {
      x: normalizeNumber(payload?.layout_offset_meters?.x ?? payload?.layoutOffsetMeters?.x, 0),
      y: normalizeNumber(payload?.layout_offset_meters?.y ?? payload?.layoutOffsetMeters?.y, 0),
    };
    const corners = buildRectangleCornersFromCenterModel(center, headingDegrees, widthMeters, heightMeters);

    return {
      anchorQuality: payload?.anchor_quality ?? "approximate",
      calibrationMode: "center_heading_size",
      center,
      confidenceNote:
        payload?.confidence_note ??
        "Initial center-based calibration is active and can be refined later in admin.",
      corners,
      gardenId: payload?.garden_id ?? 3,
      headingDegrees,
      imageUrl:
        typeof payload?.image_url === "string" && payload.image_url.trim() !== ""
          ? payload.image_url.trim()
          : DEFAULT_IMAGE_URL,
      layoutOffsetMeters,
      mapBounds: buildBoundsFromCorners(corners),
      notes: Array.isArray(payload?.notes) ? payload.notes : [],
      sizeMeters: {
        height: heightMeters,
        width: widthMeters,
      },
    };
  }

  const payloadCorners = payload?.corners ?? {};
  const topLeft = normalizePoint(payloadCorners.topLeft ?? payloadCorners.northWest, {
    lat: -7.006962,
    lng: 109.601791,
  });
  const topRight = normalizePoint(payloadCorners.topRight ?? payloadCorners.northEast, {
    lat: -7.006951,
    lng: 109.602754,
  });
  const bottomRight = normalizePoint(payloadCorners.bottomRight ?? payloadCorners.southEast, {
    lat: -7.008749,
    lng: 109.60314,
  });
  const bottomLeft = normalizePoint(payloadCorners.bottomLeft ?? payloadCorners.southWest, {
    lat: -7.008866,
    lng: 109.602091,
  });
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const center = {
    lat: (topLeft.lat + topRight.lat + bottomRight.lat + bottomLeft.lat) / 4,
    lng: (topLeft.lng + topRight.lng + bottomRight.lng + bottomLeft.lng) / 4,
  };
  const widthMeters =
    (distanceBetweenPointsMeters(topLeft, topRight) + distanceBetweenPointsMeters(bottomLeft, bottomRight)) /
    2;
  const heightMeters =
    (distanceBetweenPointsMeters(topLeft, bottomLeft) + distanceBetweenPointsMeters(topRight, bottomRight)) /
    2;
  const headingDegrees = bearingBetweenPoints(center, {
    lat: (topLeft.lat + topRight.lat) / 2,
    lng: (topLeft.lng + topRight.lng) / 2,
  });

  return {
    anchorQuality: payload?.anchor_quality ?? "approximate",
    calibrationMode: "four_corner",
    center,
    confidenceNote:
      payload?.confidence_note ??
      "Initial four-corner calibration is active and can be refined later in admin.",
    corners,
    gardenId: payload?.garden_id ?? 3,
    headingDegrees,
    imageUrl:
      typeof payload?.image_url === "string" && payload.image_url.trim() !== ""
        ? payload.image_url.trim()
        : DEFAULT_IMAGE_URL,
    layoutOffsetMeters: {
      x: 0,
      y: 0,
    },
    mapBounds: buildBoundsFromCorners(corners),
    notes: Array.isArray(payload?.notes) ? payload.notes : [],
    sizeMeters: {
      height: heightMeters,
      width: widthMeters,
    },
  };
}

function serializeCorners(corners) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;

  return {
    bottomLeft,
    bottomRight,
    topLeft,
    topRight,
  };
}

export function serializeDroneCalibration(calibration) {
  if (calibration?.calibrationMode === "center_heading_size") {
    return {
      anchor_quality: calibration.anchorQuality ?? "approximate",
      calibration_mode: "center_heading_size",
      center: calibration.center,
      confidence_note: calibration.confidenceNote,
      garden_id: calibration.gardenId ?? 3,
      heading_degrees: calibration.headingDegrees,
      height_meters: calibration.sizeMeters?.height ?? DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.height,
      image_url: calibration.imageUrl ?? DEFAULT_IMAGE_URL,
      layout_offset_meters: calibration.layoutOffsetMeters ?? { x: 0, y: 0 },
      notes: Array.isArray(calibration.notes) ? calibration.notes : [],
      width_meters: calibration.sizeMeters?.width ?? DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.width,
    };
  }

  return {
    anchor_quality: calibration?.anchorQuality ?? "approximate",
    calibration_mode: "four_corner",
    confidence_note: calibration?.confidenceNote,
    corners: serializeCorners(calibration?.corners ?? DEFAULT_GARDEN_3_DRONE_CALIBRATION.corners),
    garden_id: calibration?.gardenId ?? 3,
    image_url: calibration?.imageUrl ?? DEFAULT_IMAGE_URL,
    notes: Array.isArray(calibration?.notes) ? calibration.notes : [],
  };
}

export function normalizeDroneCalibration(payload) {
  return normalizeCalibration(payload);
}

export const DEFAULT_GARDEN_3_DRONE_CALIBRATION = normalizeCalibration({
  calibration_mode: "center_heading_size",
  center: DEFAULT_GARDEN_3_CALIBRATION.center,
  garden_id: 3,
  heading_degrees: DEFAULT_GARDEN_3_CALIBRATION.headingDegrees,
  height_meters: DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.height,
  image_url: DEFAULT_IMAGE_URL,
  width_meters: DEFAULT_GARDEN_3_CALIBRATION.sizeMeters.width,
});

export function readStoredGarden3DroneCalibration() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedPayload = window.localStorage.getItem(DRONE_CALIBRATION_STORAGE_KEY);

    if (!storedPayload) {
      return null;
    }

    return normalizeCalibration(JSON.parse(storedPayload));
  } catch {
    return null;
  }
}

export function persistGarden3DroneCalibration(calibration) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(
      DRONE_CALIBRATION_STORAGE_KEY,
      JSON.stringify(serializeDroneCalibration(calibration)),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredGarden3DroneCalibration() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.removeItem(DRONE_CALIBRATION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function loadGarden3DroneCalibration() {
  if (isAdminSupabaseConfigured()) {
    try {
      const calibrationRecord = await fetchGardenDroneCalibrationRecord(
        DEFAULT_GARDEN_3_DRONE_CALIBRATION.gardenId,
      );

      if (calibrationRecord?.calibration != null) {
        return normalizeCalibration(calibrationRecord.calibration);
      }
    } catch {
      // Fall through to local and bundled calibration sources.
    }
  }

  const storedCalibration = readStoredGarden3DroneCalibration();

  if (storedCalibration != null) {
    return storedCalibration;
  }

  try {
    const response = await fetch(DRONE_CALIBRATION_URL);

    if (!response.ok) {
      return DEFAULT_GARDEN_3_DRONE_CALIBRATION;
    }

    const payload = await response.json();
    return normalizeCalibration(payload);
  } catch {
    return DEFAULT_GARDEN_3_DRONE_CALIBRATION;
  }
}
