const CLOUDINARY_CLOUD_NAME = (import.meta.env.VITE_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
const CLOUDINARY_UPLOAD_PRESET = (
  import.meta.env.VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? ""
).trim();
const INVENTORY_IMAGE_FOLDER = "item-image";

export function isCloudinaryInventoryUploadConfigured() {
  return CLOUDINARY_CLOUD_NAME !== "" && CLOUDINARY_UPLOAD_PRESET !== "";
}

export async function uploadInventoryItemImage(file) {
  if (!(file instanceof File)) {
    throw new Error("Select a valid image file before uploading.");
  }

  if (!isCloudinaryInventoryUploadConfigured()) {
    throw new Error(
      "Cloudinary upload is not configured. Set VITE_PUBLIC_CLOUDINARY_CLOUD_NAME and VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const formData = new FormData();
  formData.set("file", file);
  formData.set("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.set("folder", INVENTORY_IMAGE_FOLDER);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      body: formData,
      method: "POST",
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? `Cloudinary upload failed (${response.status}).`,
    );
  }

  if (typeof payload?.secure_url !== "string" || payload.secure_url.trim() === "") {
    throw new Error("Cloudinary upload succeeded without an image URL.");
  }

  return payload.secure_url;
}
