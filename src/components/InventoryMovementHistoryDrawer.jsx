const MOVEMENT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

const PRICE_FORMATTER = new Intl.NumberFormat("id-ID", {
  currency: "IDR",
  maximumFractionDigits: 0,
  style: "currency",
});

const MOVEMENT_LABELS = {
  ADJUSTMENT: "Penyesuaian",
  DISPOSAL: "Disposal",
  IN: "Stok Masuk",
  MAINTENANCE: "Maintenance",
  OUT: "Stok Keluar",
};

function formatStockValue(value) {
  return Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
  });
}

function formatMovementDate(createdAt) {
  const parsedDate = new Date(createdAt);
  return Number.isNaN(parsedDate.getTime()) ? "Unknown date" : MOVEMENT_DATE_FORMATTER.format(parsedDate);
}

function resolveMovementClassName(type) {
  if (type === "IN") {
    return "inventory-history-row--in";
  }

  if (type === "ADJUSTMENT") {
    return "inventory-history-row--adjustment";
  }

  return "inventory-history-row--out";
}

export function InventoryMovementHistoryDrawer({ item, onClose, userRole }) {
  if (item == null) {
    return null;
  }

  const isAdmin = userRole === "admin";
  const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;
  const movements = Array.isArray(item.movements) ? item.movements : [];

  return (
    <div className="inventory-history-backdrop" onClick={onClose}>
      <aside
        aria-labelledby="inventory-history-title"
        aria-modal="true"
        className="inventory-history-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="inventory-history-drawer__header">
          <div>
            <p className="section-kicker">Ledger History</p>
            <h2 id="inventory-history-title">{itemTitle}</h2>
            <span>
              Current stock: {formatStockValue(item.currentStock)} {item.unit}
            </span>
          </div>
          <button className="inventory-modal__close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {movements.length === 0 ? (
          <div className="inventory-history-empty">
            <strong>No movements yet</strong>
            <span>This item exists, but no stock ledger entries are attached.</span>
          </div>
        ) : (
          <div className="inventory-history-list">
            {movements.map((movement) => (
              <article
                className={`inventory-history-row ${resolveMovementClassName(movement.type)}`}
                key={movement.id}
              >
                <div className="inventory-history-row__header">
                  <div>
                    <strong>{MOVEMENT_LABELS[movement.type] ?? movement.type}</strong>
                    <span>{formatMovementDate(movement.createdAt)}</span>
                  </div>
                  <span className="inventory-history-row__qty">
                    {movement.qty > 0 ? "+" : ""}
                    {formatStockValue(movement.qty)} {item.unit}
                  </span>
                </div>

                <div className="inventory-history-row__meta">
                  <span>Reason: {movement.reason}</span>
                  {movement.expiryDate ? <span>Expiry: {movement.expiryDate}</span> : null}
                  {isAdmin && movement.pricePerUnit != null ? (
                    <span>Price: {PRICE_FORMATTER.format(movement.pricePerUnit)}</span>
                  ) : null}
                </div>

                {movement.notes ? <p>{movement.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
