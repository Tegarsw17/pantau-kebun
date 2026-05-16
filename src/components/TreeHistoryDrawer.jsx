import { useEffect } from "react";
import { UpdateMediaGallery } from "./UpdateMediaGallery.jsx";

const NO_REPORT_NOTE = "No field report submitted yet.";
const NO_REPORT_UPDATED_AT = "No report yet";

function countMediaByKind(mediaAssets) {
  return (Array.isArray(mediaAssets) ? mediaAssets : []).reduce(
    (summary, mediaAsset) => {
      const mediaKind =
        mediaAsset?.kind === "image" || mediaAsset?.kind === "video" ? mediaAsset.kind : "unknown";

      summary[mediaKind] += 1;
      return summary;
    },
    {
      image: 0,
      unknown: 0,
      video: 0,
    },
  );
}

export function TreeHistoryDrawer({
  historyEntries,
  latestHistoryEntry,
  onClose,
  reportRow,
  selectedTree,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (reportRow == null && selectedTree == null) {
    return null;
  }

  const resolvedCondition = latestHistoryEntry?.condition ?? selectedTree?.condition ?? null;
  const resolvedBadgeStyle =
    latestHistoryEntry?.badgeStyle ?? reportRow?.badgeStyle ?? resolvedCondition?.badgeStyle ?? null;
  const resolvedConditionIcon =
    latestHistoryEntry?.conditionIcon ?? reportRow?.conditionIcon ?? resolvedCondition?.icon ?? "●";
  const resolvedConditionLabel =
    latestHistoryEntry?.kondisi ?? reportRow?.kondisi ?? resolvedCondition?.label ?? "Unknown";
  const resolvedTreeId = selectedTree?.treeIdDisplay ?? reportRow?.treeId ?? "Unknown";
  const resolvedPlantName = selectedTree?.plantName ?? reportRow?.plantName ?? "Unknown Plant";
  const resolvedPlantType = selectedTree?.plantType?.label ?? reportRow?.jenis ?? "Unknown";
  const resolvedUpdatedAt = latestHistoryEntry?.updatedAt ?? reportRow?.updatedAt ?? NO_REPORT_UPDATED_AT;
  const resolvedNote = latestHistoryEntry?.note ?? reportRow?.note ?? NO_REPORT_NOTE;
  const mediaAssets = Array.isArray(latestHistoryEntry?.mediaAssets) ? latestHistoryEntry.mediaAssets : [];
  const mediaCounts = countMediaByKind(mediaAssets);
  const historyCount = Array.isArray(historyEntries) ? historyEntries.length : 0;

  return (
    <div className="history-drawer-backdrop" onClick={onClose}>
      <aside
        aria-labelledby="tree-history-drawer-title"
        aria-modal="true"
        className="history-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="history-drawer__header">
          <div className="history-drawer__header-copy">
            <p className="history-drawer__eyebrow">Tree History</p>
            <h2 id="tree-history-drawer-title">{resolvedTreeId}</h2>
            <p className="history-drawer__subtitle">{resolvedPlantName}</p>
          </div>

          <button
            aria-label="Close tree history"
            className="history-drawer__close"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="history-drawer__summary">
          <span className="history-drawer__summary-chip">{resolvedPlantType}</span>
          <span className="history-drawer__summary-chip">
            {selectedTree != null ? "Mapped on canvas" : "No mapped coordinate"}
          </span>
          <span className="history-drawer__summary-chip">
            {historyCount === 1 ? "1 update loaded" : `${historyCount} updates loaded`}
          </span>
        </div>

        <section className="history-drawer__section">
          <p className="history-drawer__label">Current Condition</p>
          <div className="history-drawer__status-row">
            <span className="status-badge" style={resolvedBadgeStyle ?? undefined}>
              {resolvedConditionIcon} {resolvedConditionLabel}
            </span>
            <span className="history-drawer__timestamp">{resolvedUpdatedAt}</span>
          </div>
        </section>

        <section className="history-drawer__section">
          <p className="history-drawer__label">Latest Field Note</p>
          <p className="history-drawer__note">{resolvedNote}</p>
        </section>

        <section className="history-drawer__section">
          <p className="history-drawer__label">Attached Media</p>
          <div className="history-drawer__summary">
            <span className="history-drawer__summary-chip">{mediaAssets.length} total</span>
            <span className="history-drawer__summary-chip">{mediaCounts.image} images</span>
            <span className="history-drawer__summary-chip">{mediaCounts.video} videos</span>
          </div>

          <UpdateMediaGallery mediaAssets={mediaAssets} />
        </section>
      </aside>
    </div>
  );
}
