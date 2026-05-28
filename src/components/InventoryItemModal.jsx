import { useEffect, useState } from "react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
  isCloudinaryInventoryUploadConfigured,
  uploadInventoryItemImage,
} from "../data/cloudinaryInventory.js";
import {
  INVENTORY_CATEGORIES,
  buildInventoryItemPayload,
  buildInventoryItemUpdatePayload,
  buildInventoryItems,
  buildStockMovementPayload,
  normalizeInventoryItem,
  normalizeInventoryMovement,
  saveInventoryItem,
  saveInventoryStockMovement,
  updateInventoryItem,
  updateInventoryItemActiveStatus,
} from "../data/inventoryData.js";

export function InventoryItemModal({ item = null, mode = "create", onClose, onSaved }) {
  const isEditing = mode === "edit" && item != null;
  const [name, setName] = useState(item?.name ?? "");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [category, setCategory] = useState(item?.category ?? INVENTORY_CATEGORIES[0]);
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    item == null ? "" : String(item.lowStockThreshold),
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [initialPricePerUnit, setInitialPricePerUnit] = useState("");
  const [initialExpiryDate, setInitialExpiryDate] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedImageFile == null) {
      setPreviewImageUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewImageUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImageFile]);

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

    if (!isEditing && initialQuantity.trim() !== "") {
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

    if (selectedImageFile != null && !selectedImageFile.type.startsWith("image/")) {
      return "Selected file must be an image.";
    }

    if (selectedImageFile != null && !isCloudinaryInventoryUploadConfigured()) {
      return "Cloudinary env vars are required before uploading item images.";
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
      const resolvedImageUrl =
        selectedImageFile == null ? imageUrl : await uploadInventoryItemImage(selectedImageFile);
      const itemPayload = {
        brand,
        category,
        imageUrl: resolvedImageUrl,
        lowStockThreshold,
        name,
        unit,
      };

      if (isEditing) {
        const savedItem = await updateInventoryItem({
          itemId: item.id,
          payload: buildInventoryItemUpdatePayload(itemPayload),
        });
        const normalizedItem = normalizeInventoryItem(savedItem, item.movements);

        onSaved({
          ...normalizedItem,
          movements: item.movements,
        });
        toast.success("Inventory item updated.");
        onClose();
        return;
      }

      const savedItem = await saveInventoryItem(buildInventoryItemPayload(itemPayload));
      const numericInitialQuantity = Number(initialQuantity);
      const shouldCreateInitialMovement =
        Number.isFinite(numericInitialQuantity) && numericInitialQuantity > 0;
      let savedMovement = null;
      let normalizedMovement = null;

      if (shouldCreateInitialMovement) {
        savedMovement = await saveInventoryStockMovement(
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
        savedMovement == null ? [] : [savedMovement],
      )[0];

      onSaved(
        normalizedMovement == null
          ? normalizedItem
          : {
              ...normalizedItem,
              currentStock: normalizedItem.currentStock + normalizedMovement.qty,
            },
      );
      toast.success("Inventory item added.");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inventory item could not be saved.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!isEditing || item == null || isSaving) {
      return;
    }

    const nextIsActive = !item.isActive;
    const confirmationMessage = nextIsActive
      ? "Restore this item to active inventory?"
      : "Archive this item? Existing movement history will be preserved.";
    const confirmation = await Swal.fire({
      background: "#071116",
      cancelButtonColor: "#26343b",
      color: "#edf7f8",
      confirmButtonColor: nextIsActive ? "#1f7a45" : "#8a2f2f",
      confirmButtonText: nextIsActive ? "Restore Item" : "Archive Item",
      icon: nextIsActive ? "question" : "warning",
      showCancelButton: true,
      text: confirmationMessage,
      title: nextIsActive ? "Restore item?" : "Archive item?",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const savedItem = await updateInventoryItemActiveStatus({
        isActive: nextIsActive,
        itemId: item.id,
      });
      const normalizedItem = normalizeInventoryItem(savedItem, item.movements);

      onSaved({
        ...normalizedItem,
        movements: item.movements,
      });
      toast.success(nextIsActive ? "Inventory item restored." : "Inventory item archived.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Inventory item status could not be updated.";
      setErrorMessage(message);
      toast.error(message);
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
              <h2 id="inventory-item-title">{isEditing ? "Edit Item" : "Tambah Item"}</h2>
              <span>
                {isEditing
                  ? "Update item identity, category, threshold, and image."
                  : "Create a stock item and optional initial ledger entry."}
              </span>
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

            <div className="control-block inventory-image-upload">
              <span className="control-label">Item Image</span>
              <div className="inventory-image-upload__surface">
                {previewImageUrl || imageUrl ? (
                  <img
                    alt="Inventory item preview"
                    className="inventory-image-upload__preview"
                    src={previewImageUrl || imageUrl}
                  />
                ) : (
                  <span>Upload to Cloudinary / item-image</span>
                )}
              </div>
              <input
                accept="image/*"
                className="inventory-form-input inventory-form-input--file"
                disabled={isSaving}
                onChange={(event) => {
                  setSelectedImageFile(event.target.files?.[0] ?? null);
                  setImageUrl("");
                  setErrorMessage("");
                }}
                type="file"
              />
              <span className="inventory-form-hint">
                Uses `VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET` and folder `item-image`.
              </span>
            </div>

            {!isEditing ? (
              <>
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
              </>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="inventory-form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="inventory-modal__footer">
            {isEditing ? (
              <button
                className={`inventory-modal__button ${
                  item.isActive
                    ? "inventory-modal__button--danger"
                    : "inventory-modal__button--success"
                }`}
                disabled={isSaving}
                onClick={handleStatusChange}
                type="button"
              >
                {item.isActive ? "Archive Item" : "Restore Item"}
              </button>
            ) : null}
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
              {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Save Item"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
