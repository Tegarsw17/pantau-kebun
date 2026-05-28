const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function readEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

function buildSupabaseRestUrl(pathname: string, searchParams: Record<string, string>) {
  const url = new URL(pathname, readEnv("SUPABASE_URL"));

  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function createCloudinarySignature(
  params: Record<string, string>,
  apiSecret: string,
) {
  const signaturePayload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const encodedPayload = new TextEncoder().encode(`${signaturePayload}${apiSecret}`);
  const digest = await crypto.subtle.digest("SHA-1", encodedPayload);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveCaller(accessToken: string) {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(new URL("/auth/v1/user", supabaseUrl), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return {
      role: "",
      userId: "",
    };
  }

  const payload = await response.json().catch(() => null);

  return {
    role:
      (typeof payload?.app_role === "string" ? payload.app_role : "") ||
      (typeof payload?.app_metadata?.role === "string" ? payload.app_metadata.role : "") ||
      (typeof payload?.user_metadata?.role === "string" ? payload.user_metadata.role : ""),
    userId: typeof payload?.id === "string" ? payload.id : "",
  };
}

async function isInventoryAdmin(userId: string) {
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    buildSupabaseRestUrl("/rest/v1/user_roles", {
      limit: "1",
      select: "role",
      user_id: `eq.${userId}`,
    }),
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return false;
  }

  const roles = await response.json().catch(() => []);
  const role = Array.isArray(roles) ? roles[0]?.role : "";

  return role === "admin" || role === "inventory_admin";
}

async function deleteCloudinaryImage(publicId: string) {
  const cloudName = readEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = readEnv("CLOUDINARY_API_KEY");
  const apiSecret = readEnv("CLOUDINARY_API_SECRET");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedParams = {
    invalidate: "true",
    public_id: publicId,
    timestamp,
  };
  const signature = await createCloudinarySignature(signedParams, apiSecret);
  const formData = new FormData();

  formData.set("api_key", apiKey);
  formData.set("invalidate", signedParams.invalidate);
  formData.set("public_id", signedParams.public_id);
  formData.set("signature", signature);
  formData.set("timestamp", signedParams.timestamp);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      body: formData,
      method: "POST",
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : `Cloudinary delete failed (${response.status}).`,
    );
  }

  return payload;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const requiredEnvNames = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missingEnvNames = requiredEnvNames.filter((name) => readEnv(name) === "");

  if (missingEnvNames.length > 0) {
    return jsonResponse(
      {
        error: `Missing Edge Function env vars: ${missingEnvNames.join(", ")}.`,
      },
      500,
    );
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (accessToken === "") {
    return jsonResponse({ error: "Missing authenticated admin session." }, 401);
  }

  const caller = await resolveCaller(accessToken);

  if (caller.userId === "") {
    return jsonResponse({ error: "Invalid authenticated admin session." }, 401);
  }

  if (
    caller.role !== "admin" &&
    caller.role !== "inventory_admin" &&
    !(await isInventoryAdmin(caller.userId))
  ) {
    return jsonResponse({ error: "Only inventory admins can delete item images." }, 403);
  }

  const payload = await request.json().catch(() => null);
  const publicId = typeof payload?.publicId === "string" ? payload.publicId.trim() : "";

  if (publicId === "") {
    return jsonResponse({ error: "Cloudinary publicId is required." }, 400);
  }

  if (!publicId.startsWith("item-image/") || publicId.includes("..")) {
    return jsonResponse({ error: "Only item-image assets can be deleted." }, 400);
  }

  try {
    const cloudinaryPayload = await deleteCloudinaryImage(publicId);

    return jsonResponse({
      publicId,
      result: cloudinaryPayload?.result ?? "unknown",
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Cloudinary image could not be deleted.",
      },
      502,
    );
  }
});
