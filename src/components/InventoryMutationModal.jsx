import { useEffect, useState } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  INVENTORY_MUTATION_OPTIONS,
  INVENTORY_REASON_OPTIONS,
  buildStockMovementPayload,
  normalizeInventoryMovement,
  saveInventoryStockMovement,
} from "../data/inventoryData.js";

const DEFAULT_MUTATION_TYPE = "IN";
const DEFAULT_REASON = "Pembelian";

function formatStockValue(value) {
  return Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
  });
}

function resolveMutationLabel(value) {
  return INVENTORY_MUTATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function InventoryMutationModal({ item, onClose, onSaved }) {
  const [mutationType, setMutationType] = useState(DEFAULT_MUTATION_TYPE);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
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

  if (item == null) {
    return null;
  }

  const isIncomingStock = mutationType === "IN";
  const itemTitle = item.brand ? `${item.name} (${item.brand})` : item.name;

  const validateForm = () => {
    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return "Quantity must be greater than 0.";
    }

    if (!isIncomingStock && numericQuantity > item.currentStock) {
      return "Outgoing stock cannot exceed current stock.";
    }

    if (isIncomingStock) {
      const numericPrice = Number(pricePerUnit);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return "Price per unit is required for Stok Masuk.";
      }
    }

    return "";
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const validationMessage = validateForm();

    if (validationMessage !== "") {
      setErrorMessage(validationMessage);
      await Swal.fire({
        background: "#071116",
        color: "#edf7f8",
        confirmButtonColor: "#b27624",
        icon: "warning",
        text: validationMessage,
        title: "Check mutation input",
      });
      return;
    }

    const numericQuantity = Number(quantity);
    const nextStock = isIncomingStock
      ? item.currentStock + numericQuantity
      : item.currentStock - numericQuantity;
    const confirmation = await Swal.fire({
      background: "#071116",
      cancelButtonColor: "#26343b",
      color: "#edf7f8",
      confirmButtonColor: "#b27624",
      confirmButtonText: "Save Mutation",
      icon: "question",
      showCancelButton: true,
      text: `${itemTitle}\nType: ${resolveMutationLabel(mutationType)}\nQuantity: ${formatStockValue(
        numericQuantity,
      )} ${item.unit}\nReason: ${reason}\nStock after save: ${formatStockValue(nextStock)} ${
        item.unit
      }`,
      title: "Save stock mutation?",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const payload = buildStockMovementPayload({
        expiryDate,
        itemId: item.id,
        notes,
        pricePerUnit,
        quantity,
        reason,
        type: mutationType,
      });
      const savedMovement = await saveInventoryStockMovement(payload);

      onSaved(normalizeInventoryMovement(savedMovement));
      toast.success("Stock mutation saved.");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stock mutation could not be saved.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="inventory-modal-backdrop" onClick={isSaving ? undefined : onClose}>
      <section
        aria-labelledby="inventory-mutation-title"
        aria-modal="true"
        className="inventory-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <form className="inventory-mutation-form" onSubmit={handleSave}>
          <div className="inventory-modal__header">
            <div>
              <p className="section-kicker">Mutasi Stok</p>
              <h2 id="inventory-mutation-title">{itemTitle}</h2>
              <span>
                Current stock: {formatStockValue(item.currentStock)} {item.unit}
              </span>
            </div>
            <button
              aria-label="Close stock mutation modal"
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
              <span className="control-label">Mutation Type</span>
              <select
                disabled={isSaving}
                onChange={(event) => {
                  setMutationType(event.target.value);
                  setErrorMessage("");
                }}
                value={mutationType}
              >
                {INVENTORY_MUTATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="control-block">
              <span className="control-label">Quantity</span>
              <input
                className="inventory-form-input"
                disabled={isSaving}
                min="0"
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setErrorMessage("");
                }}
                placeholder={`0 ${item.unit}`}
                step="0.01"
                type="number"
                value={quantity}
              />
            </label>

            <label className="control-block">
              <span className="control-label">Reason</span>
              <select
                disabled={isSaving}
                onChange={(event) => {
                  setReason(event.target.value);
                  setErrorMessage("");
                }}
                value={reason}
              >
                {INVENTORY_REASON_OPTIONS.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </option>
                ))}
              </select>
            </label>

            {isIncomingStock ? (
              <>
                <label className="control-block">
                  <span className="control-label">Price per Unit</span>
                  <input
                    className="inventory-form-input"
                    disabled={isSaving}
                    min="0"
                    onChange={(event) => {
                      setPricePerUnit(event.target.value);
                      setErrorMessage("");
                    }}
                    placeholder="0"
                    step="1"
                    type="number"
                    value={pricePerUnit}
                  />
                </label>

                <label className="control-block">
                  <span className="control-label">Expiry Date</span>
                  <input
                    className="inventory-form-input"
                    disabled={isSaving}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    type="date"
                    value={expiryDate}
                  />
                </label>
              </>
            ) : null}

            <label className="control-block inventory-mutation-form__notes">
              <span className="control-label">Notes</span>
              <textarea
                className="inventory-form-textarea"
                disabled={isSaving}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for this movement"
                rows={4}
                value={notes}
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
              {isSaving ? "Saving..." : "Save Mutation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
