import {
  buildSupabaseHeaders,
  buildSupabaseUrl,
  extractSupabaseError,
  isAdminSupabaseConfigured,
} from "./adminOrchardSupabase.js";

export const INVENTORY_CATEGORIES = [
  "Pupuk & Nutrisi",
  "ZPT & Hormon",
  "Agrokimia",
  "Alat & Logistik",
];

export const ALL_INVENTORY_CATEGORIES = "Semua Kategori";

export const INVENTORY_MUTATION_OPTIONS = [
  {
    label: "Stok Masuk",
    reason: "Pembelian",
    value: "IN",
  },
  {
    label: "Stok Keluar",
    reason: "Aplikasi Lahan",
    value: "OUT",
  },
  {
    label: "Penyesuaian",
    reason: "Penyesuaian Stok",
    value: "ADJUSTMENT",
  },
];

const STATIC_ITEMS = [
  {
    brand: "Merauke",
    category: "Pupuk & Nutrisi",
    created_at: "2026-01-08T03:12:00Z",
    current_stock: 13.5,
    id: "static-npk-merauke",
    image_url: "/inventory-pupuk.svg",
    low_stock_threshold: 8,
    name: "NPK 16-16-16",
    unit: "Sak",
  },
  {
    brand: "GreenGrow",
    category: "ZPT & Hormon",
    created_at: "2026-01-12T04:30:00Z",
    current_stock: 4,
    id: "static-zpt-root",
    image_url: "/inventory-zpt.svg",
    low_stock_threshold: 5,
    name: "Root Booster",
    unit: "Botol",
  },
  {
    brand: "Bayer",
    category: "Agrokimia",
    created_at: "2026-02-03T06:10:00Z",
    current_stock: 0,
    id: "static-fungicide",
    image_url: "/inventory-agrokimia.svg",
    low_stock_threshold: 3,
    name: "Fungisida Sistemik",
    unit: "Liter",
  },
  {
    brand: "FieldPro",
    category: "Alat & Logistik",
    created_at: "2026-02-11T08:45:00Z",
    current_stock: 24,
    id: "static-polybag",
    image_url: "/inventory-logistik.svg",
    low_stock_threshold: 12,
    name: "Polybag 40x50",
    unit: "Pack",
  },
  {
    brand: "Petrokimia",
    category: "Pupuk & Nutrisi",
    created_at: "2026-02-20T02:20:00Z",
    current_stock: 7,
    id: "static-dolomit",
    image_url: "/inventory-pupuk.svg",
    low_stock_threshold: 7,
    name: "Dolomit Granul",
    unit: "Sak",
  },
  {
    brand: "CropShield",
    category: "Agrokimia",
    created_at: "2026-03-05T05:25:00Z",
    current_stock: 2.5,
    id: "static-insecticide",
    image_url: "/inventory-agrokimia.svg",
    low_stock_threshold: 2,
    name: "Insektisida Kontak",
    unit: "Liter",
  },
];

const STATIC_MOVEMENTS = [
  {
    created_at: "2026-03-08T07:00:00Z",
    expiry_date: "2026-11-30",
    id: "static-move-npk-in",
    item_id: "static-npk-merauke",
    notes: "Batch awal untuk pemupukan blok timur.",
    price_per_unit: 185000,
    qty: 20,
    reason: "Pembelian",
    type: "IN",
  },
  {
    created_at: "2026-03-18T07:00:00Z",
    expiry_date: null,
    id: "static-move-npk-out",
    item_id: "static-npk-merauke",
    notes: "Aplikasi lahan durian muda.",
    price_per_unit: null,
    qty: -6.5,
    reason: "Aplikasi Lahan",
    type: "OUT",
  },
  {
    created_at: "2026-02-12T05:00:00Z",
    expiry_date: "2026-08-18",
    id: "static-move-zpt-in",
    item_id: "static-zpt-root",
    notes: "Perlu dipakai sebelum akhir musim kemarau.",
    price_per_unit: 68000,
    qty: 4,
    reason: "Pembelian",
    type: "IN",
  },
  {
    created_at: "2026-02-06T02:10:00Z",
    expiry_date: "2026-04-30",
    id: "static-move-fungicide-in",
    item_id: "static-fungicide",
    notes: "Stok habis setelah perlakuan jamur batang.",
    price_per_unit: 142000,
    qty: 3,
    reason: "Pembelian",
    type: "IN",
  },
  {
    created_at: "2026-03-02T09:00:00Z",
    expiry_date: null,
    id: "static-move-fungicide-out",
    item_id: "static-fungicide",
    notes: "Batch terakhir digunakan.",
    price_per_unit: null,
    qty: -3,
    reason: "Aplikasi Lahan",
    type: "OUT",
  },
  {
    created_at: "2026-03-15T04:20:00Z",
    expiry_date: null,
    id: "static-move-polybag-in",
    item_id: "static-polybag",
    notes: "Logistik nursery.",
    price_per_unit: 32000,
    qty: 24,
    reason: "Pembelian",
    type: "IN",
  },
  {
    created_at: "2026-03-21T06:00:00Z",
    expiry_date: "2027-01-15",
    id: "static-move-dolomit-in",
    item_id: "static-dolomit",
    notes: "Koreksi pH untuk blok barat.",
    price_per_unit: 94000,
    qty: 7,
    reason: "Pembelian",
    type: "IN",
  },
  {
    created_at: "2026-04-11T06:00:00Z",
    expiry_date: "2026-10-05",
    id: "static-move-insecticide-in",
    item_id: "static-insecticide",
    notes: "Cadangan untuk pengendalian hama.",
    price_per_unit: 118000,
    qty: 2.5,
    reason: "Pembelian",
    type: "IN",
  },
];

function normalizeNumber(value, fallbackValue = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function normalizeText(value, fallbackValue = "") {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallbackValue;
}

function normalizeDateValue(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function resolveCreatedAtEpoch(value) {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function normalizeItem(item) {
  return {
    brand: normalizeText(item?.brand, ""),
    category: INVENTORY_CATEGORIES.includes(item?.category)
      ? item.category
      : INVENTORY_CATEGORIES[0],
    createdAt: normalizeDateValue(item?.created_at),
    currentStock: normalizeNumber(item?.current_stock),
    id: String(item?.id),
    imageUrl: normalizeText(item?.image_url, ""),
    lowStockThreshold: normalizeNumber(item?.low_stock_threshold),
    name: normalizeText(item?.name, "Unnamed Item"),
    unit: normalizeText(item?.unit, "Unit"),
  };
}

export function normalizeInventoryMovement(movement) {
  return {
    createdAt: normalizeDateValue(movement?.created_at),
    createdAtEpoch: resolveCreatedAtEpoch(movement?.created_at),
    expiryDate: normalizeDateValue(movement?.expiry_date),
    id: String(movement?.id),
    itemId: String(movement?.item_id),
    notes: normalizeText(movement?.notes, ""),
    pricePerUnit:
      movement?.price_per_unit == null ? null : normalizeNumber(movement.price_per_unit, null),
    qty: normalizeNumber(movement?.qty),
    reason: normalizeText(movement?.reason, "Inventory Movement"),
    type: normalizeText(movement?.type, "OUT"),
  };
}

function buildMovementSummaryByItemId(movements) {
  const summaryByItemId = new Map();

  movements.forEach((movement) => {
    const currentSummary = summaryByItemId.get(movement.itemId) ?? {
      latestExpiryDate: null,
      latestIncomingPrice: null,
      latestMovement: null,
      movements: [],
    };

    currentSummary.movements.push(movement);
    summaryByItemId.set(movement.itemId, currentSummary);
  });

  summaryByItemId.forEach((summary) => {
    summary.movements.sort((leftMovement, rightMovement) => {
      return rightMovement.createdAtEpoch - leftMovement.createdAtEpoch;
    });
    summary.latestMovement = summary.movements[0] ?? null;
    summary.latestExpiryDate =
      summary.movements.find((movement) => movement.expiryDate != null)?.expiryDate ?? null;
    summary.latestIncomingPrice =
      summary.movements.find(
        (movement) => movement.type === "IN" && movement.pricePerUnit != null,
      )?.pricePerUnit ?? null;
  });

  return summaryByItemId;
}

export function buildInventoryItems(items, movements) {
  const normalizedMovements = (Array.isArray(movements) ? movements : []).map(
    normalizeInventoryMovement,
  );
  const summaryByItemId = buildMovementSummaryByItemId(normalizedMovements);

  return (Array.isArray(items) ? items : []).map((item) => {
    const normalizedItem = normalizeItem(item);
    const movementSummary = summaryByItemId.get(normalizedItem.id) ?? {
      latestExpiryDate: null,
      latestIncomingPrice: null,
      latestMovement: null,
      movements: [],
    };

    return {
      ...normalizedItem,
      latestExpiryDate: movementSummary.latestExpiryDate,
      latestIncomingPrice: movementSummary.latestIncomingPrice,
      latestMovement: movementSummary.latestMovement,
      movements: movementSummary.movements,
    };
  });
}

export async function fetchInventoryItems() {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase inventory connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/items", {
      order: "name.asc",
      select: "id,name,brand,image_url,category,current_stock,unit,low_stock_threshold,created_at",
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

export async function fetchInventoryMovements() {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Supabase inventory connection is not configured.");
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/stock_movements", {
      order: "created_at.desc",
      select:
        "id,item_id,type,qty,price_per_unit,expiry_date,reason,notes,created_at",
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

export async function loadInventoryWorkspace({ allowStaticFallback = true } = {}) {
  if (isAdminSupabaseConfigured()) {
    try {
      const [items, movements] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryMovements(),
      ]);

      return {
        dataSource: "supabase",
        items: buildInventoryItems(items, movements),
        loadMessage: "Supabase inventory loaded.",
      };
    } catch {
      if (!allowStaticFallback) {
        throw new Error("Supabase inventory data could not be loaded.");
      }

      return {
        dataSource: "static",
        items: buildInventoryItems(STATIC_ITEMS, STATIC_MOVEMENTS),
        loadMessage: "Supabase inventory unavailable. Static inventory preview loaded.",
      };
    }
  }

  if (!allowStaticFallback) {
    throw new Error("Supabase inventory connection is not configured.");
  }

  return {
    dataSource: "static",
    items: buildInventoryItems(STATIC_ITEMS, STATIC_MOVEMENTS),
    loadMessage: "Static inventory preview loaded.",
  };
}

export function buildStockMovementPayload({ expiryDate, itemId, notes, pricePerUnit, quantity, type }) {
  const mutationOption =
    INVENTORY_MUTATION_OPTIONS.find((option) => option.value === type) ??
    INVENTORY_MUTATION_OPTIONS[1];
  const normalizedQuantity = Math.abs(normalizeNumber(quantity));
  const signedQuantity = type === "IN" ? normalizedQuantity : -normalizedQuantity;

  return {
    expiry_date: type === "IN" && expiryDate ? expiryDate : null,
    item_id: itemId,
    notes: normalizeText(notes, ""),
    price_per_unit: type === "IN" ? normalizeNumber(pricePerUnit) : null,
    qty: signedQuantity,
    reason: mutationOption.reason,
    type,
  };
}

export function buildInventoryItemPayload({
  brand,
  category,
  imageUrl,
  lowStockThreshold,
  name,
  unit,
}) {
  return {
    brand: normalizeText(brand, "") || null,
    category: INVENTORY_CATEGORIES.includes(category) ? category : INVENTORY_CATEGORIES[0],
    current_stock: 0,
    image_url: normalizeText(imageUrl, "") || null,
    low_stock_threshold: normalizeNumber(lowStockThreshold),
    name: normalizeText(name, "Unnamed Item"),
    unit: normalizeText(unit, "Unit"),
  };
}

export async function saveInventoryItem(payload) {
  if (!isAdminSupabaseConfigured()) {
    return {
      ...payload,
      created_at: new Date().toISOString(),
      id: `local-item-${crypto.randomUUID()}`,
    };
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/items", {
      select: "id,name,brand,image_url,category,current_stock,unit,low_stock_threshold,created_at",
    }),
    {
      body: JSON.stringify(payload),
      headers: buildSupabaseHeaders({
        Prefer: "return=representation",
      }),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No inventory item was saved.");
  }

  return rows[0];
}

export async function saveInventoryStockMovement(payload) {
  if (!isAdminSupabaseConfigured()) {
    return {
      ...payload,
      created_at: new Date().toISOString(),
      id: `local-${crypto.randomUUID()}`,
    };
  }

  const response = await fetch(
    buildSupabaseUrl("/rest/v1/stock_movements", {
      select: "id,item_id,type,qty,price_per_unit,expiry_date,reason,notes,created_at",
    }),
    {
      body: JSON.stringify(payload),
      headers: buildSupabaseHeaders({
        Prefer: "return=representation",
      }),
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(await extractSupabaseError(response));
  }

  const rows = await response.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No stock movement was saved.");
  }

  return rows[0];
}
