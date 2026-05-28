const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();
const SUPABASE_SCHEMA = "public";
const GARDEN_DRONE_CALIBRATIONS_TABLE = "garden_drone_calibrations";
const ADMIN_AUTH_SESSION_KEY = "pantaukebun.supabase.admin.session";

function readStoredAdminAuthSession() {
  try {
    const rawSession = window.localStorage.getItem(ADMIN_AUTH_SESSION_KEY);

    return rawSession == null ? null : JSON.parse(rawSession);
  } catch {
    return null;
  }
}

function writeStoredAdminAuthSession(session) {
  try {
    if (session == null) {
      window.localStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
      return;
    }

    window.localStorage.setItem(ADMIN_AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures; the request can still use the in-memory response.
  }
}

function normalizeAuthSession(payload) {
  const expiresIn = Number(payload?.expires_in);
  const expiresAt =
    Number(payload?.expires_at) ||
    Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600);

  return {
    accessToken: payload?.access_token ?? "",
    expiresAt,
    refreshToken: payload?.refresh_token ?? "",
    user: {
      email: payload?.user?.email ?? "",
      id: payload?.user?.id ?? "",
    },
  };
}

export function isAdminAuthSessionValid(session = readStoredAdminAuthSession()) {
  return (
    typeof session?.accessToken === "string" &&
    session.accessToken !== "" &&
    Number(session?.expiresAt) > Math.floor(Date.now() / 1000) + 30
  );
}

export function readAdminAuthSession() {
  const session = readStoredAdminAuthSession();

  return isAdminAuthSessionValid(session) ? session : null;
}

export function getAdminAuthAccessToken() {
  return readAdminAuthSession()?.accessToken ?? "";
}

export async function signInAdminWithPassword({ email, password }) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase auth connection is not configured.");
  }

  const response = await fetch(buildSupabaseUrl("/auth/v1/token", { grant_type: "password" }), {
    body: JSON.stringify({
      email,
      password,
    }),
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const session = normalizeAuthSession(await response.json());
  writeStoredAdminAuthSession(session);

  return session;
}

export async function signOutAdminAuth() {
  const accessToken = getAdminAuthAccessToken();
  writeStoredAdminAuthSession(null);

  if (!isAdminSupabaseConfigured() || accessToken === "") {
    return;
  }

  await fetch(buildSupabaseUrl("/auth/v1/logout"), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
  }).catch(() => undefined);
}

export function buildSupabaseHeaders(extraHeaders = {}) {
  const accessToken = getAdminAuthAccessToken();

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": SUPABASE_SCHEMA,
    "Content-Profile": SUPABASE_SCHEMA,
    ...extraHeaders,
  };
}

export function buildSupabaseUrl(pathname, searchParams = {}) {
  const url = new URL(pathname, SUPABASE_URL);

  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export async function extractSupabaseError(response) {
  const fallbackMessage = `Supabase request failed (${response.status}).`;
  const rawPayload = await response.text();

  if (rawPayload.trim() === "") {
    return fallbackMessage;
  }

  try {
    const parsedPayload = JSON.parse(rawPayload);

    return (
      parsedPayload.message ??
      (typeof parsedPayload.error === "string" ? parsedPayload.error : undefined) ??
      parsedPayload.error_description ??
      parsedPayload.details ??
      parsedPayload.hint ??
      fallbackMessage
    );
  } catch {
    return rawPayload;
  }
}

export function isAdminSupabaseConfigured() {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

export function getAdminPersistenceMode() {
  return isAdminSupabaseConfigured() ? "supabase" : "static";
}

export async function fetchGardenPlants(gardenId) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/plants", {
      select: "id,garden_id,plant_type_id,plant_name,created_at,latitude,longitude",
      garden_id: `eq.${gardenId}`,
      order: "created_at.asc",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function fetchPlantTypes() {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/plant_types", {
      select: "id,name,color",
      order: "name.asc",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function fetchConditions() {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/conditions", {
      select: "id,name,color,icon,display_order,is_active",
      is_active: "eq.true",
      order: "display_order.asc,id.asc",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function fetchPlantUpdates(gardenName) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const searchParams = {
    select:
      "id,garden,type,plant_id,desc,date,created_at,condition_ids,media,media_type,media_new,media_type_new",
    order: "created_at.desc",
  };

  if (typeof gardenName === "string" && gardenName.trim() !== "") {
    searchParams.garden = `eq.${gardenName.trim()}`;
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/updates", searchParams),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function fetchAdminUnmappedPlants(gardenId) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/plants", {
      select: "id,garden_id,plant_type_id,plant_name,created_at,latitude,longitude",
      garden_id: `eq.${gardenId}`,
      latitude: "is.null",
      order: "created_at.asc",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function fetchAdminMappedPlants(gardenId) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/plants", {
      select: "id,garden_id,plant_type_id,plant_name,created_at,latitude,longitude",
      garden_id: `eq.${gardenId}`,
      latitude: "not.is.null",
      longitude: "not.is.null",
      order: "created_at.asc",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  return response.json();
}

export async function saveAdminTreePlacement({ plantId, latitude, longitude }) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error(
      "Supabase sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable persistence.",
    );
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/plants", {
      id: `eq.${String(plantId)}`,
      select: "id,latitude,longitude",
    }),
    {
      method: "PATCH",
      headers: buildSupabaseHeaders({
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        latitude,
        longitude,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No plant record was updated for tree ${plantId}.`);
  }

  return rows[0];
}

export async function fetchGardenDroneCalibrationRecord(gardenId) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase admin connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl(`/rest/v1/${GARDEN_DRONE_CALIBRATIONS_TABLE}`, {
      garden_id: `eq.${gardenId}`,
      limit: "1",
      select: "id,garden_id,calibration,created_at,updated_at",
    }),
    {
      headers: buildSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function saveGardenDroneCalibrationRecord({ gardenId, calibration }) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error(
      "Supabase sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable persistence.",
    );
  }

  const existingRecord = await fetchGardenDroneCalibrationRecord(gardenId);
  const payload = {
    calibration,
    garden_id: gardenId,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(
    buildSupabaseUrl(`/rest/v1/${GARDEN_DRONE_CALIBRATIONS_TABLE}`, {
      ...(existingRecord ? { id: `eq.${existingRecord.id}` } : {}),
      select: "id,garden_id,calibration,created_at,updated_at",
    }),
    {
      method: existingRecord ? "PATCH" : "POST",
      headers: buildSupabaseHeaders({
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No calibration record was saved for garden ${gardenId}.`);
  }

  return rows[0];
}

export async function deleteGardenDroneCalibrationRecord(gardenId) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error(
      "Supabase sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable persistence.",
    );
  }

  const existingRecord = await fetchGardenDroneCalibrationRecord(gardenId);

  if (existingRecord == null) {
    return null;
  }

  const response = await fetch(
    buildSupabaseUrl(`/rest/v1/${GARDEN_DRONE_CALIBRATIONS_TABLE}`, {
      id: `eq.${existingRecord.id}`,
      select: "id,garden_id,calibration,created_at,updated_at",
    }),
    {
      method: "DELETE",
      headers: buildSupabaseHeaders({
        Prefer: "return=representation",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : existingRecord;
}
