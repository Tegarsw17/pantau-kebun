import { useEffect, useState } from "react";
import { MediaViewerDialog } from "./MediaViewerDialog.jsx";

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

function MediaPreview({ mediaAsset }) {
  if (mediaAsset?.kind === "image") {
    return (
      <img
        alt={MEDIA_KIND_LABELS.image}
        className="media-gallery__image"
        loading="lazy"
        src={mediaAsset.url}
      />
    );
  }

  if (mediaAsset?.kind === "video") {
    return (
      <video className="media-gallery__video" muted playsInline preload="metadata" src={mediaAsset.url} />
    );
  }

  return <div className="media-gallery__unknown">Attachment</div>;
}

export function UpdateMediaGallery({ layout = "grid", mediaAssets }) {
  const resolvedMediaAssets = Array.isArray(mediaAssets) ? mediaAssets : [];
  const [activeMediaIndex, setActiveMediaIndex] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    setActiveMediaIndex(null);
    setCarouselIndex(0);
  }, [resolvedMediaAssets]);

  const handleNavigate = (direction) => {
    setActiveMediaIndex((currentIndex) => {
      if (currentIndex == null) {
        return currentIndex;
      }

      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= resolvedMediaAssets.length) {
        return currentIndex;
      }

      return nextIndex;
    });
  };

  const handleCarouselNavigate = (direction) => {
    setCarouselIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= resolvedMediaAssets.length) {
        return currentIndex;
      }

      return nextIndex;
    });
  };

  if (resolvedMediaAssets.length === 0) {
    return (
      <div className="history-drawer__empty-state">
        <strong>No media attached</strong>
        <span>This latest report does not include photo or video evidence.</span>
      </div>
    );
  }

  const activeCarouselMedia = resolvedMediaAssets[carouselIndex] ?? resolvedMediaAssets[0] ?? null;

  if (layout === "carousel") {
    return (
      <>
        <div className="media-carousel" role="region" aria-label="Report media carousel">
          <div className="media-carousel__stage-shell">
            <button
              aria-label="Show previous media"
              className="media-carousel__nav"
              disabled={carouselIndex === 0}
              onClick={() => handleCarouselNavigate(-1)}
              type="button"
            >
              Prev
            </button>

            <button
              aria-label={`Open media ${carouselIndex + 1} in fullscreen`}
              className="media-carousel__stage"
              onClick={() => setActiveMediaIndex(carouselIndex)}
              type="button"
            >
              <div className="media-carousel__preview">
                <MediaPreview mediaAsset={activeCarouselMedia} />
                <span className="media-carousel__kind">
                  {MEDIA_KIND_LABELS[activeCarouselMedia?.kind] ?? MEDIA_KIND_LABELS.unknown}
                </span>
              </div>
            </button>

            <button
              aria-label="Show next media"
              className="media-carousel__nav"
              disabled={carouselIndex >= resolvedMediaAssets.length - 1}
              onClick={() => handleCarouselNavigate(1)}
              type="button"
            >
              Next
            </button>
          </div>

          <div className="media-carousel__meta">
            <strong>
              {MEDIA_KIND_LABELS[activeCarouselMedia?.kind] ?? MEDIA_KIND_LABELS.unknown}{" "}
              {carouselIndex + 1}
            </strong>
            <span>{formatMimeLabel(activeCarouselMedia)}</span>
            <span>
              {carouselIndex + 1} / {resolvedMediaAssets.length}
            </span>
            <button
              className="media-carousel__viewer-trigger"
              onClick={() => setActiveMediaIndex(carouselIndex)}
              type="button"
            >
              Preview fullscreen
            </button>
          </div>

          {resolvedMediaAssets.length > 1 ? (
            <div className="media-carousel__track" role="list">
              {resolvedMediaAssets.map((mediaAsset, index) => (
                <button
                  aria-label={`Show media ${index + 1}`}
                  className={`media-carousel__thumb ${
                    index === carouselIndex ? "media-carousel__thumb--active" : ""
                  }`}
                  key={mediaAsset.id ?? `${mediaAsset.url}-${index}`}
                  onClick={() => setCarouselIndex(index)}
                  role="listitem"
                  type="button"
                >
                  <div className="media-carousel__thumb-preview">
                    <MediaPreview mediaAsset={mediaAsset} />
                  </div>
                  <span className="media-carousel__thumb-index">{index + 1}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <MediaViewerDialog
          activeIndex={activeMediaIndex}
          mediaAssets={resolvedMediaAssets}
          onClose={() => setActiveMediaIndex(null)}
          onNavigate={handleNavigate}
        />
      </>
    );
  }

  return (
    <>
      <div className="media-gallery" role="list">
        {resolvedMediaAssets.map((mediaAsset, index) => (
          <button
            className="media-gallery__card"
            key={mediaAsset.id ?? `${mediaAsset.url}-${index}`}
            onClick={() => setActiveMediaIndex(index)}
            role="listitem"
            type="button"
          >
            <div className="media-gallery__preview">
              <MediaPreview mediaAsset={mediaAsset} />
              <span className="media-gallery__kind">
                {MEDIA_KIND_LABELS[mediaAsset.kind] ?? MEDIA_KIND_LABELS.unknown}
              </span>
            </div>

            <div className="media-gallery__meta">
              <strong>
                {MEDIA_KIND_LABELS[mediaAsset.kind] ?? MEDIA_KIND_LABELS.unknown} {index + 1}
              </strong>
              <span>{formatMimeLabel(mediaAsset)}</span>
              <span className="media-gallery__action">Preview fullscreen</span>
            </div>
          </button>
        ))}
      </div>

      <MediaViewerDialog
        activeIndex={activeMediaIndex}
        mediaAssets={resolvedMediaAssets}
        onClose={() => setActiveMediaIndex(null)}
        onNavigate={handleNavigate}
      />
    </>
  );
}
