import { useEffect, useState } from "react";
import {
  INVENTORY_CATEGORIES,
  buildInventoryItemPayload,
  buildInventoryItems,
  buildStockMovementPayload,
  normalizeInventoryMovement,
  saveInventoryItem,
  saveInventoryStockMovement,
} from "../data/inventoryData.js";

export function InventoryItemModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState(INVENTORY_CATEGORIES[0]);
  const [unit, setUnit] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [initialPricePerUnit, setInitialPricePerUnit] = useState("");
  const [initialExpiryDate, setInitialExpiryDate] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const validateForm = () => {
    if (name.trim() === "") {
      return "Item name is required.";
    }

    if (unit.trim() === "") {
      return "Unit is required.";
    }

    const numericThreshold = Number(lowStockThreshold);

    if (!Number.isFinite(numericThreshold) || numericThreshold < 0) {
      return "Low stock threshold must be 0 or greater.";
    }

    if (initialQuantity.trim() !== "") {
      const numericInitialQuantity = Number(initialQuantity);

      if (!Number.isFinite(numericInitialQuantity) || numericInitialQuantity < 0) {
        return "Initial stock must be 0 or greater.";
      }

      if (numericInitialQuantity > 0) {
        const numericInitialPrice = Number(initialPricePerUnit);

        if (!Number.isFinite(numericInitialPrice) || numericInitialPrice < 0) {
          return "Initial price per unit is required when initial stock is filled.";
        }
      }
    }

    return "";
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const validationMessage = validateForm();

    if (validationMessage !== "") {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const savedItem = await saveInventoryItem(
        buildInventoryItemPayload({
          brand,
          category,
          imageUrl,
          lowStockThreshold,
          name,
          unit,
        }),
      );
      const numericInitialQuantity = Number(initialQuantity);
      const shouldCreateInitialMovement =
        Number.isFinite(numericInitialQuantity) && numericInitialQuantity > 0;
      let normalizedMovement = null;

      if (shouldCreateInitialMovement) {
        const savedMovement = await saveInventoryStockMovement(
          buildStockMovementPayload({
            expiryDate: initialExpiryDate,
            itemId: savedItem.id,
            notes: initialNotes || "Initial stock",
            pricePerUnit: initialPricePerUnit,
            quantity: initialQuantity,
            type: "IN",
          }),
        );

        normalizedMovement = normalizeInventoryMovement(savedMovement);
      }

      const normalizedItem = buildInventoryItems(
        [savedItem],
        normalizedMovement == null ? [] : [normalizedMovement],
      )[0];

      onSaved(
        normalizedMovement == null
          ? normalizedItem
          : {
              ...normalizedItem,
              currentStock: normalizedItem.currentStock + normalizedMovement.qty,
            },
      );
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Inventory item could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="inventory-modal-backdrop" onClick={isSaving ? undefined : onClose}>
      <section
        aria-labelledby="inventory-item-title"
        aria-modal="true"
        className="inventory-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form className="inventory-mutation-form" onSubmit={handleSave}>
          <div className="inventory-modal__header">
            <div>
              <p className="section-kicker">Master Item</p>
              <h2 id="inventory-item-title">Tambah Item</h2>
              <span>Create a stock item and optional initial ledger entry.</span>
            </div>
            <button
              aria-label="Close add item modal"
              className="inventory-modal__close"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="inventory-mutation-form__grid">
            <label className="control-block">
              <span className="control-label">Item Name</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="NPK 16-16-16"
                type="text"
                value={name}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Brand</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Merauke"
                type="text"
                value={brand}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Category</span>
              <select
                disabled={isSaving}
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                {INVENTORY_CATEGORIES.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption}>
                    {categoryOption}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-block">
              <span className="control-label">Unit</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => {
                  setUnit(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="Sak, Liter, Botol"
                type="text"
                value={unit}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Low Stock Threshold</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                min="0"
                onChange={(event) => {
                  setLowStockThreshold(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="8"
                step="0.01"
                type="number"
                value={lowStockThreshold}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Image URL</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://... or /inventory-pupuk.svg"
                type="url"
                value={imageUrl}
              />
            </label>

            <div className="inventory-form-divider">
              <span>Optional Initial Stock</span>
            </div>

            <label className="control-block">
              <span className="control-label">Initial Quantity</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                min="0"
                onChange={(event) => {
                  setInitialQuantity(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="0"
                step="0.01"
                type="number"
                value={initialQuantity}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Initial Price per Unit</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                min="0"
                onChange={(event) => {
                  setInitialPricePerUnit(event.target.value);
                  setErrorMessage("");
                }}
                placeholder="185000"
                step="1"
                type="number"
                value={initialPricePerUnit}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Initial Expiry Date</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => setInitialExpiryDate(event.target.value)}
                type="date"
                value={initialExpiryDate}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Initial Notes</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                onChange={(event) => setInitialNotes(event.target.value)}
                placeholder="Initial stock"
                type="text"
                value={initialNotes}
              />
            </label>
          </div>

          {errorMessage ? (
            <p className="inventory-form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="inventory-modal__footer">
            <button
              className="inventory-modal__button"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inventory-modal__button inventory-modal__button--primary"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
