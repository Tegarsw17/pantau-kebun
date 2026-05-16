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

export function UpdateMediaGallery({ mediaAssets }) {
  const resolvedMediaAssets = Array.isArray(mediaAssets) ? mediaAssets : [];

  if (resolvedMediaAssets.length === 0) {
    return (
      <div className="history-drawer__empty-state">
        <strong>No media attached</strong>
        <span>This latest report does not include photo or video evidence.</span>
      </div>
    );
  }

  return (
    <div className="media-gallery" role="list">
      {resolvedMediaAssets.map((mediaAsset, index) => (
        <a
          className="media-gallery__card"
          href={mediaAsset.url}
          key={mediaAsset.id ?? `${mediaAsset.url}-${index}`}
          rel="noreferrer"
          role="listitem"
          target="_blank"
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
            <span className="media-gallery__action">Open original</span>
          </div>
        </a>
      ))}
    </div>
  );
}
