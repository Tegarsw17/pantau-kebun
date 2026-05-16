import { useEffect } from "react";

const MEDIA_KIND_LABELS = {
  image: "Image",
  unknown: "Attachment",
  video: "Video",
};

function formatMimeLabel(mediaAsset) {
  if (typeof mediaAsset?.mimeType === "string" && mediaAsset.mimeType.trim() !== "") {
    return mediaAsset.mimeType.trim();
  }

  return MEDIA_KIND_LABELS[mediaAsset?.kind] ?? MEDIA_KIND_LABELS.unknown;
}

function MediaViewerContent({ mediaAsset }) {
  if (mediaAsset?.kind === "image") {
    return (
      <img
        alt={MEDIA_KIND_LABELS.image}
        className="media-viewer__image"
        src={mediaAsset.url}
      />
    );
  }

  if (mediaAsset?.kind === "video") {
    return (
      <video
        className="media-viewer__video"
        controls
        playsInline
        preload="metadata"
        src={mediaAsset.url}
      />
    );
  }

  return (
    <div className="media-viewer__unknown">
      <strong>Preview unavailable</strong>
      <span>This attachment can still be opened in a separate tab.</span>
    </div>
  );
}

export function MediaViewerDialog({
  activeIndex,
  mediaAssets,
  onClose,
  onNavigate,
}) {
  const resolvedMediaAssets = Array.isArray(mediaAssets) ? mediaAssets : [];
  const mediaAsset =
    activeIndex >= 0 && activeIndex < resolvedMediaAssets.length
      ? resolvedMediaAssets[activeIndex]
      : null;

  useEffect(() => {
    if (mediaAsset == null) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        onNavigate(-1);
      }

      if (event.key === "ArrowRight") {
        onNavigate(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mediaAsset, onClose, onNavigate]);

  if (mediaAsset == null) {
    return null;
  }

  const isFirstAsset = activeIndex <= 0;
  const isLastAsset = activeIndex >= resolvedMediaAssets.length - 1;

  return (
    <div className="media-viewer-backdrop" onClick={onClose}>
      <section
        aria-modal="true"
        className="media-viewer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="media-viewer__toolbar">
          <div className="media-viewer__meta">
            <strong>
              {MEDIA_KIND_LABELS[mediaAsset.kind] ?? MEDIA_KIND_LABELS.unknown} {activeIndex + 1} /{" "}
              {resolvedMediaAssets.length}
            </strong>
            <span>{formatMimeLabel(mediaAsset)}</span>
          </div>

          <div className="media-viewer__actions">
            <a
              className="media-viewer__link"
              href={mediaAsset.url}
              rel="noreferrer"
              target="_blank"
            >
              Open Original
            </a>
            <button className="media-viewer__close" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="media-viewer__body">
          <button
            className="media-viewer__nav media-viewer__nav--prev"
            disabled={isFirstAsset}
            onClick={() => onNavigate(-1)}
            type="button"
          >
            Prev
          </button>

          <div className="media-viewer__frame">
            <MediaViewerContent mediaAsset={mediaAsset} />
          </div>

          <button
            className="media-viewer__nav media-viewer__nav--next"
            disabled={isLastAsset}
            onClick={() => onNavigate(1)}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
