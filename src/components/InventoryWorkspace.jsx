import {
  Boxes,
  CalendarClock,
  CircleX,
  Download,
  Grid2X2,
  TableOfContents,
  TriangleAlert,
} from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ALL_INVENTORY_CATEGORIES,
  INVENTORY_CATEGORIES,
  loadInventoryWorkspace,
} from "../data/inventoryData.js";
import { InventoryItemModal } from "./InventoryItemModal.jsx";
import { InventoryMovementHistoryDrawer } from "./InventoryMovementHistoryDrawer.jsx";
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

function formatCsvValue(value) {
  if (value == null) {
    return "";
  }

  const stringValue = String(value);

  if (!/[",\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function buildCsvContent(rows) {
  return rows.map((row) => row.map(formatCsvValue).join(",")).join("\n");
}

function formatLedgerExportDate(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return [
    `${pad(parsedDate.getDate())}-${pad(parsedDate.getMonth() + 1)}-${parsedDate.getFullYear()}`,
    `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`,
  ].join(" ");
}

function buildInventoryLedgerRows(items) {
  const rows = [
    [
      "Movement Date",
      "Item",
      "Brand",
      "Category",
      "Status",
      "Type",
      "Quantity",
      "Unit",
      "Price Per Unit",
      "Total Value",
      "Expiry Date",
      "Reason",
      "Notes",
      "Actor",
    ],
  ];

  items.forEach((item) => {
    const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;

    item.movements.forEach((movement) => {
      const totalValue =
        movement.pricePerUnit == null ? "" : Math.abs(movement.qty) * movement.pricePerUnit;

      rows.push([
        formatLedgerExportDate(movement.createdAt),
        itemTitle,
        item.brand,
        item.category,
        item.isActive ? "Active" : "Archived",
        movement.type,
        movement.qty,
        item.unit,
        movement.pricePerUnit ?? "",
        totalValue,
        movement.expiryDate ?? "",
        movement.reason,
        movement.notes,
        movement.createdBy,
      ]);
    });
  });

  return rows;
}

function downloadCsvFile({ filename, rows }) {
  const blob = new Blob([`\uFEFF${buildCsvContent(rows)}`], {
    type: "text/csv;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
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

function itemMatchesFilterScope(item, selectedCategory, normalizedQuery) {
  const matchesCategory =
    selectedCategory === ALL_INVENTORY_CATEGORIES || item.category === selectedCategory;

  return matchesCategory && itemMatchesSearch(item, normalizedQuery);
}

function buildInventorySummary(items) {
  const activeItems = items.filter((item) => item.isActive);
  const expiryRiskItems = activeItems.filter(
    (item) => resolveExpiryState(item.latestExpiryDate) != null,
  );
  const expiredItems = activeItems.filter((item) => {
    return resolveExpiryState(item.latestExpiryDate)?.className === "inventory-expiry--expired";
  });

  return {
    activeCount: activeItems.length,
    expiryRiskCount: expiryRiskItems.length,
    expiredCount: expiredItems.length,
    lowStockCount: activeItems.filter(
      (item) => item.currentStock > 0 && item.currentStock <= item.lowStockThreshold,
    ).length,
    outOfStockCount: activeItems.filter((item) => item.currentStock === 0).length,
  };
}

function CategoryFallbackVisual({ visual }) {
  return <span className="inventory-card__visual-mark">{visual.label}</span>;
}

function InventorySummaryCards({ summary }) {
  const cards = [
    {
      icon: Boxes,
      label: "Active Items",
      tone: "cyan",
      value: summary.activeCount,
    },
    {
      icon: TriangleAlert,
      label: "Low Stock",
      tone: "amber",
      value: summary.lowStockCount,
    },
    {
      icon: CircleX,
      label: "Out of Stock",
      tone: "red",
      value: summary.outOfStockCount,
    },
    {
      helper: `${summary.expiredCount} expired`,
      icon: CalendarClock,
      label: "Expiry Risk",
      tone: "green",
      value: summary.expiryRiskCount,
    },
  ];

  return (
    <section className="inventory-summary-grid" aria-label="Inventory summary">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article
            className={`inventory-summary-card inventory-summary-card--${card.tone}`}
            key={card.label}
          >
            <div className="inventory-summary-card__icon">
              <Icon size={18} strokeWidth={2} />
            </div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              {card.helper ? <small>{card.helper}</small> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function InventoryItemCard({ item, onEditRequest, onHistoryRequest, onMutationRequest, userRole }) {
  const [hasImageError, setHasImageError] = useState(false);
  const isAdmin = userRole === "admin";
  const visual = CATEGORY_VISUALS[item.category] ?? CATEGORY_VISUALS["Pupuk & Nutrisi"];
  const stockState = resolveStockState(item);
  const expiryState = resolveExpiryState(item.latestExpiryDate);
  const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;

  return (
    <article className={`inventory-card ${isAdmin ? "inventory-card--admin" : ""}`}>
      <div
        className={`inventory-card__visual ${visual.accent} ${
          item.imageUrl && !hasImageError ? "inventory-card__visual--image" : ""
        }`}
      >
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
          {!item.isActive ? <span className="inventory-archive-badge">Archived</span> : null}
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
        <div className="inventory-card__actions">
          <button
            className="inventory-secondary-button"
            onClick={() => onEditRequest?.(item)}
            type="button"
          >
            Edit
          </button>
          <button
            className="inventory-mutation-button"
            disabled={!item.isActive}
            onClick={() => onMutationRequest?.(item)}
            type="button"
          >
            Mutasi Stok
          </button>
        </div>
      ) : null}

      <button
        className={`inventory-card-history-button ${
          isAdmin ? "inventory-card-history-button--admin" : ""
        }`}
        onClick={() => onHistoryRequest?.(item)}
        type="button"
      >
        View History
      </button>
    </article>
  );
}

function InventoryTableView({ items, onEditRequest, onHistoryRequest, onMutationRequest, userRole }) {
  const isAdmin = userRole === "admin";

  return (
    <div className="inventory-table-shell">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Threshold</th>
            <th>Expiry</th>
            {isAdmin ? <th>Last Price</th> : null}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const visual = CATEGORY_VISUALS[item.category] ?? CATEGORY_VISUALS["Pupuk & Nutrisi"];
            const stockState = resolveStockState(item);
            const expiryState = resolveExpiryState(item.latestExpiryDate);
            const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;

            return (
              <tr key={item.id}>
                <td>
                  <div className="inventory-table-item">
                    <div className={`inventory-table-thumb ${visual.accent}`}>
                      {item.imageUrl ? (
                        <img alt={itemTitle} src={item.imageUrl} />
                      ) : (
                        <span>{visual.label}</span>
                      )}
                    </div>
                    <div>
                      <strong>{itemTitle}</strong>
                      <span>{item.unit}</span>
                      {!item.isActive ? (
                        <span className="inventory-table-archive-label">Archived</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="inventory-category-badge">{item.category}</span>
                </td>
                <td>
                  <span className={`inventory-table-stock ${stockState.className}`}>
                    {formatStockValue(item.currentStock)} {item.unit}
                    <small>{stockState.label}</small>
                  </span>
                </td>
                <td>
                  {formatStockValue(item.lowStockThreshold)} {item.unit}
                </td>
                <td>
                  {expiryState ? (
                    <span className={`inventory-expiry ${expiryState.className}`}>
                      {expiryState.label}
                    </span>
                  ) : (
                    <span className="inventory-table-muted">No expiry</span>
                  )}
                </td>
                {isAdmin ? (
                  <td>
                    {item.latestIncomingPrice == null ? (
                      <span className="inventory-table-muted">No price</span>
                    ) : (
                      PRICE_FORMATTER.format(item.latestIncomingPrice)
                    )}
                  </td>
                ) : null}
                <td>
                  <button
                    className="inventory-table-action"
                    onClick={() => onHistoryRequest?.(item)}
                    type="button"
                  >
                    History
                  </button>
                  {isAdmin ? (
                    <>
                      <button
                        className="inventory-table-action"
                        onClick={() => onEditRequest?.(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="inventory-table-action inventory-table-action--primary"
                        disabled={!item.isActive}
                        onClick={() => onMutationRequest?.(item)}
                        type="button"
                      >
                        Mutasi
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const isAdmin = userRole === "admin";
  const [inventorySnapshot, setInventorySnapshot] = useState({
    dataSource: isAdmin ? "supabase" : "static",
    items: [],
    loadMessage: "Loading inventory",
    loadState: "loading",
  });
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedEditItem, setSelectedEditItem] = useState(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [selectedMutationItem, setSelectedMutationItem] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState("active");
  const [selectedCategory, setSelectedCategory] = useState(ALL_INVENTORY_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let isMounted = true;

    loadInventoryWorkspace({
      allowStaticFallback: !isAdmin,
      includeFinancials: isAdmin,
      includeArchived: isAdmin,
    })
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
          dataSource: isAdmin ? "supabase" : "static",
          items: [],
          loadMessage: isAdmin
            ? "Supabase inventory data could not be loaded."
            : "Inventory data could not be loaded.",
          loadState: "error",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const summaryScopeItems = inventorySnapshot.items.filter((item) => {
    return itemMatchesFilterScope(item, selectedCategory, normalizedSearchQuery);
  });
  const inventorySummary = buildInventorySummary(summaryScopeItems);
  const filteredItems = inventorySnapshot.items.filter((item) => {
    const matchesArchiveFilter =
      !isAdmin ||
      archiveFilter === "all" ||
      (archiveFilter === "active" && item.isActive) ||
      (archiveFilter === "archived" && !item.isActive);

    return (
      matchesArchiveFilter &&
      itemMatchesFilterScope(item, selectedCategory, normalizedSearchQuery)
    );
  });
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

  const handleItemUpdated = (updatedItem) => {
    setInventorySnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      items: currentSnapshot.items
        .map((item) => (item.id === updatedItem.id ? updatedItem : item))
        .sort((leftItem, rightItem) => leftItem.name.localeCompare(rightItem.name)),
    }));
  };
  const handleLedgerExport = () => {
    const ledgerRows = buildInventoryLedgerRows(filteredItems);
    const movementCount = ledgerRows.length - 1;

    if (movementCount <= 0) {
      toast.error("No ledger movements match the current filters.");
      return;
    }

    const exportDate = new Date().toISOString().slice(0, 10);

    downloadCsvFile({
      filename: `pantau-kebun-inventory-ledger-${exportDate}.csv`,
      rows: ledgerRows,
    });
    toast.success(`Exported ${movementCount} ledger movements.`);
  };

  return (
    <>
      <main className="dashboard inventory-workspace">
        <section className="workspace-panel workspace-panel--primary inventory-hero">
          <p className="section-kicker inventory-hero__title">Etalase Inventory</p>

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
        </section>

        {inventorySnapshot.loadState === "ready" ? (
          <InventorySummaryCards summary={inventorySummary} />
        ) : null}

        <section className="inventory-grid-section" aria-label="Inventory Storefront">
          <div className="inventory-grid-actions">
            {isAdmin ? (
              <div className="inventory-grid-actions__left">
                <button
                  className="inventory-add-button"
                  disabled={inventorySnapshot.loadState !== "ready"}
                  onClick={() => setIsItemModalOpen(true)}
                  type="button"
                >
                  Tambah Item
                </button>

                <button
                  className="inventory-export-button"
                  disabled={inventorySnapshot.loadState !== "ready"}
                  onClick={handleLedgerExport}
                  type="button"
                >
                  <Download size={16} strokeWidth={2} />
                  Export Ledger
                </button>

                <div className="inventory-archive-tabs" aria-label="Inventory archive filter">
                  {[
                    ["active", "Active"],
                    ["archived", "Archived"],
                    ["all", "All"],
                  ].map(([value, label]) => (
                    <button
                      className={`inventory-archive-tab ${
                        archiveFilter === value ? "inventory-archive-tab--active" : ""
                      }`}
                      disabled={inventorySnapshot.loadState !== "ready"}
                      key={value}
                      onClick={() => setArchiveFilter(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="inventory-view-toggle" aria-label="Inventory view mode">
              <button
                aria-pressed={viewMode === "grid"}
                className={`inventory-view-toggle__button ${
                  viewMode === "grid" ? "inventory-view-toggle__button--active" : ""
                }`}
                onClick={() => setViewMode("grid")}
                type="button"
              >
                <Grid2X2 size={16} strokeWidth={2} />
                Card
              </button>
              <button
                aria-pressed={viewMode === "table"}
                className={`inventory-view-toggle__button ${
                  viewMode === "table" ? "inventory-view-toggle__button--active" : ""
                }`}
                onClick={() => setViewMode("table")}
                type="button"
              >
                <TableOfContents size={16} strokeWidth={2} />
                Table
              </button>
            </div>
          </div>

          {inventorySnapshot.loadState === "loading" ? (
            <div className="inventory-empty-state">
              <strong>Loading inventory</strong>
              <span>Preparing stock cards and movement summaries.</span>
            </div>
          ) : inventorySnapshot.loadState === "error" ? (
            <div className="inventory-empty-state">
              <strong>Inventory unavailable</strong>
              <span>
                {isAdmin
                  ? "Admin inventory requires Supabase tables and environment variables."
                  : "Check Supabase configuration or static preview data."}
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="inventory-empty-state">
              <strong>No items found</strong>
              <span>Try another search term or category filter.</span>
            </div>
          ) : viewMode === "table" ? (
            <InventoryTableView
              items={filteredItems}
              onEditRequest={setSelectedEditItem}
              onHistoryRequest={setSelectedHistoryItem}
              onMutationRequest={setSelectedMutationItem}
              userRole={userRole}
            />
          ) : (
            <div className="inventory-grid">
              {filteredItems.map((item) => (
                <InventoryItemCard
                  item={item}
                  key={item.id}
                  onEditRequest={setSelectedEditItem}
                  onHistoryRequest={setSelectedHistoryItem}
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

      {isAdmin && selectedEditItem != null ? (
        <InventoryItemModal
          item={selectedEditItem}
          mode="edit"
          onClose={() => setSelectedEditItem(null)}
          onSaved={handleItemUpdated}
        />
      ) : null}

      {selectedHistoryItem != null ? (
        <InventoryMovementHistoryDrawer
          item={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
          userRole={userRole}
        />
      ) : null}
    </>
  );
}
