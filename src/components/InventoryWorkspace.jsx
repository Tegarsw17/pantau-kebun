import { useDeferredValue, useEffect, useState } from "react";
import {
  ALL_INVENTORY_CATEGORIES,
  INVENTORY_CATEGORIES,
  loadInventoryWorkspace,
} from "../data/inventoryData.js";
import { InventoryItemModal } from "./InventoryItemModal.jsx";
import { InventoryMutationModal } from "./InventoryMutationModal.jsx";

const EXPIRY_WARNING_MONTHS = 6;
const PRICE_FORMATTER = new Intl.NumberFormat("id-ID", {
  currency: "IDR",
  maximumFractionDigits: 0,
  style: "currency",
});

const CATEGORY_VISUALS = {
  Agrokimia: {
    accent: "inventory-visual--agrochemical",
    label: "AG",
  },
  "Alat & Logistik": {
    accent: "inventory-visual--logistics",
    label: "AL",
  },
  "Pupuk & Nutrisi": {
    accent: "inventory-visual--nutrient",
    label: "PN",
  },
  "ZPT & Hormon": {
    accent: "inventory-visual--hormone",
    label: "ZH",
  },
};

function formatStockValue(value) {
  return Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
  });
}

function resolveStockState(item) {
  if (item.currentStock === 0) {
    return {
      className: "inventory-stock--out",
      label: "Out of Stock",
      tone: "red",
    };
  }

  if (item.currentStock <= item.lowStockThreshold) {
    return {
      className: "inventory-stock--low",
      label: "Low Stock",
      tone: "yellow",
    };
  }

  return {
    className: "inventory-stock--safe",
    label: "Safe",
    tone: "green",
  };
}

function addMonths(date, monthCount) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + monthCount);
  return nextDate;
}

function resolveExpiryState(expiryDate) {
  if (expiryDate == null) {
    return null;
  }

  const parsedExpiryDate = new Date(`${expiryDate}T00:00:00`);

  if (Number.isNaN(parsedExpiryDate.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsedExpiryDate < today) {
    return {
      className: "inventory-expiry--expired",
      label: `Expired ${expiryDate}`,
    };
  }

  if (parsedExpiryDate < addMonths(today, EXPIRY_WARNING_MONTHS)) {
    return {
      className: "inventory-expiry--warning",
      label: `Exp ${expiryDate}`,
    };
  }

  return null;
}

function itemMatchesSearch(item, normalizedQuery) {
  if (normalizedQuery === "") {
    return true;
  }

  return [item.name, item.brand, item.category, item.unit]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function CategoryFallbackVisual({ visual }) {
  return <span className="inventory-card__visual-mark">{visual.label}</span>;
}

function InventoryItemCard({ item, onMutationRequest, userRole }) {
  const [hasImageError, setHasImageError] = useState(false);
  const isAdmin = userRole === "admin";
  const visual = CATEGORY_VISUALS[item.category] ?? CATEGORY_VISUALS["Pupuk & Nutrisi"];
  const stockState = resolveStockState(item);
  const expiryState = resolveExpiryState(item.latestExpiryDate);
  const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;

  return (
    <article className="inventory-card">
      <div className={`inventory-card__visual ${visual.accent}`}>
        {item.imageUrl && !hasImageError ? (
          <img
            alt={itemTitle}
            className="inventory-card__image"
            loading="lazy"
            onError={() => setHasImageError(true)}
            src={item.imageUrl}
          />
        ) : (
          <CategoryFallbackVisual visual={visual} />
        )}
      </div>

      <div className="inventory-card__body">
        <div className="inventory-card__header">
          <span className="inventory-category-badge">{item.category}</span>
          {expiryState ? (
            <span className={`inventory-expiry ${expiryState.className}`}>
              {expiryState.label}
            </span>
          ) : null}
        </div>

        <h2 className="inventory-card__title">{itemTitle}</h2>

        <div className={`inventory-stock ${stockState.className}`}>
          <div>
            <span className="inventory-stock__label">Current Stock</span>
            <strong>
              {formatStockValue(item.currentStock)} {item.unit}
            </strong>
          </div>
          <span className="inventory-stock__pill">{stockState.label}</span>
        </div>

        <div className="inventory-card__meta">
          <span>Low threshold</span>
          <strong>
            {formatStockValue(item.lowStockThreshold)} {item.unit}
          </strong>
        </div>

        {isAdmin && item.latestIncomingPrice != null ? (
          <div className="inventory-card__meta inventory-card__meta--price">
            <span>Last unit price</span>
            <strong>{PRICE_FORMATTER.format(item.latestIncomingPrice)}</strong>
          </div>
        ) : null}
      </div>

      {isAdmin ? (
        <button
          className="inventory-mutation-button"
          onClick={() => onMutationRequest?.(item)}
          type="button"
        >
          Mutasi Stok
        </button>
      ) : null}
    </article>
  );
}

function applyMovementToItem(item, movement) {
  if (String(item.id) !== String(movement.itemId)) {
    return item;
  }

  const nextMovements = [movement, ...item.movements].sort(
    (leftMovement, rightMovement) => rightMovement.createdAtEpoch - leftMovement.createdAtEpoch,
  );

  return {
    ...item,
    currentStock: item.currentStock + movement.qty,
    latestExpiryDate:
      nextMovements.find((nextMovement) => nextMovement.expiryDate != null)?.expiryDate ?? null,
    latestIncomingPrice:
      nextMovements.find(
        (nextMovement) => nextMovement.type === "IN" && nextMovement.pricePerUnit != null,
      )?.pricePerUnit ?? null,
    latestMovement: nextMovements[0] ?? null,
    movements: nextMovements,
  };
}

export function InventoryWorkspace({ userRole = "non-admin" }) {
  const [inventorySnapshot, setInventorySnapshot] = useState({
    dataSource: "static",
    items: [],
    loadMessage: "Loading inventory",
    loadState: "loading",
  });
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedMutationItem, setSelectedMutationItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_INVENTORY_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let isMounted = true;

    loadInventoryWorkspace()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setInventorySnapshot({
          dataSource: snapshot.dataSource,
          items: snapshot.items,
          loadMessage: snapshot.loadMessage,
          loadState: "ready",
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setInventorySnapshot({
          dataSource: "static",
          items: [],
          loadMessage: "Inventory data could not be loaded.",
          loadState: "error",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const filteredItems = inventorySnapshot.items.filter((item) => {
    const matchesCategory =
      selectedCategory === ALL_INVENTORY_CATEGORIES || item.category === selectedCategory;

    return matchesCategory && itemMatchesSearch(item, normalizedSearchQuery);
  });
  const isAdmin = userRole === "admin";

  const handleMovementSaved = (movement) => {
    setInventorySnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      items: currentSnapshot.items.map((item) => applyMovementToItem(item, movement)),
    }));
  };

  const handleItemSaved = (item) => {
    setInventorySnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      items: [...currentSnapshot.items, item].sort((leftItem, rightItem) =>
        leftItem.name.localeCompare(rightItem.name),
      ),
    }));
  };

  return (
    <>
      <main className="dashboard inventory-workspace">
      <section className="workspace-panel workspace-panel--primary inventory-hero">
        <div className="workspace-panel__header inventory-hero__header">
          <div className="workspace-panel__heading">
            <p className="section-kicker">Etalase Inventory</p>
            <h2>Supplies, inputs, and operational stock</h2>
          </div>

          <div className="inventory-hero-actions">
            {isAdmin ? (
              <button
                className="inventory-add-button"
                disabled={inventorySnapshot.loadState !== "ready"}
                onClick={() => setIsItemModalOpen(true)}
                type="button"
              >
                Tambah Item
              </button>
            ) : null}
            <div className="inventory-source-pill">
              {inventorySnapshot.dataSource === "supabase" ? "Live Supabase" : "Static Preview"}
            </div>
          </div>
        </div>

        <div className="inventory-toolbar">
          <label className="search-shell inventory-search" aria-label="Search inventory">
            <span className="search-shell__icon">⌕</span>
            <input
              disabled={inventorySnapshot.loadState !== "ready"}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search item, brand, category, or unit"
              type="text"
              value={searchQuery}
            />
          </label>

          <div className="inventory-tabs" aria-label="Inventory categories">
            {[ALL_INVENTORY_CATEGORIES, ...INVENTORY_CATEGORIES].map((category) => (
              <button
                className={`inventory-tab ${
                  selectedCategory === category ? "inventory-tab--active" : ""
                }`}
                disabled={inventorySnapshot.loadState !== "ready"}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="inventory-summary-strip">
          <span>{filteredItems.length} visible items</span>
          <span>{inventorySnapshot.loadMessage}</span>
          <span>{isAdmin ? "Admin mode" : "Field worker read-only mode"}</span>
        </div>
      </section>

      <section className="inventory-grid-section" aria-label="Inventory Storefront">
        {inventorySnapshot.loadState === "loading" ? (
          <div className="inventory-empty-state">
            <strong>Loading inventory</strong>
            <span>Preparing stock cards and movement summaries.</span>
          </div>
        ) : inventorySnapshot.loadState === "error" ? (
          <div className="inventory-empty-state">
            <strong>Inventory unavailable</strong>
            <span>Check Supabase configuration or static preview data.</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="inventory-empty-state">
            <strong>No items found</strong>
            <span>Try another search term or category filter.</span>
          </div>
        ) : (
          <div className="inventory-grid">
            {filteredItems.map((item) => (
              <InventoryItemCard
                item={item}
                key={item.id}
                onMutationRequest={setSelectedMutationItem}
                userRole={userRole}
              />
            ))}
          </div>
        )}
      </section>
      </main>

      {isAdmin && selectedMutationItem != null ? (
        <InventoryMutationModal
          item={selectedMutationItem}
          onClose={() => setSelectedMutationItem(null)}
          onSaved={handleMovementSaved}
        />
      ) : null}

      {isAdmin && isItemModalOpen ? (
        <InventoryItemModal
          onClose={() => setIsItemModalOpen(false)}
          onSaved={handleItemSaved}
        />
      ) : null}
    </>
  );
}
