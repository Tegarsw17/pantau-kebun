const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();
const SUPABASE_SCHEMA = "public";

function buildSupabaseHeaders(extraHeaders = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": SUPABASE_SCHEMA,
    "Content-Profile": SUPABASE_SCHEMA,
    ...extraHeaders,
  };
}

function buildSupabaseUrl(pathname, searchParams = {}) {
  const url = new URL(pathname, SUPABASE_URL);

  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function extractSupabaseError(response) {
  const fallbackMessage = `Supabase request failed (${response.status}).`;
  const rawPayload = await response.text();

  if (rawPayload.trim() === "") {
    return fallbackMessage;
  }

  try {
    const parsedPayload = JSON.parse(rawPayload);

    return (
      parsedPayload.message ??
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
