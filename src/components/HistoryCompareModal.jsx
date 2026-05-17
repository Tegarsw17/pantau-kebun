import { useEffect, useMemo, useState } from "react";
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

function normalizeHistoryEntryId(historyEntryId) {
  return historyEntryId == null ? "" : String(historyEntryId);
}

function findHistoryEntryById(historyEntries, historyEntryId) {
  const normalizedHistoryEntryId = normalizeHistoryEntryId(historyEntryId);

  if (normalizedHistoryEntryId === "") {
    return null;
  }

  return (
    (Array.isArray(historyEntries) ? historyEntries : []).find(
      (historyEntry) => normalizeHistoryEntryId(historyEntry?.id) === normalizedHistoryEntryId,
    ) ?? null
  );
}

function buildCompareOptionLabel(historyEntry) {
  const updatedAt = historyEntry?.updatedAt ?? NO_REPORT_UPDATED_AT;
  const conditionLabel = historyEntry?.kondisi ?? "Unknown";
  return `${updatedAt} • ${conditionLabel}`;
}

function ComparePanel({ historyEntry, panelLabel }) {
  const resolvedMediaAssets = Array.isArray(historyEntry?.mediaAssets) ? historyEntry.mediaAssets : [];
  const mediaCounts = countMediaByKind(resolvedMediaAssets);

  return (
    <section className="compare-modal__panel">
      <div className="compare-modal__panel-header">
        <strong>{panelLabel}</strong>
        <span>{historyEntry?.updatedAt ?? NO_REPORT_UPDATED_AT}</span>
      </div>

      <span className="status-badge" style={historyEntry?.badgeStyle ?? undefined}>
        {historyEntry?.conditionIcon ?? "●"} {historyEntry?.kondisi ?? "Unknown"}
      </span>

      <p className="compare-modal__note">{historyEntry?.note ?? NO_REPORT_NOTE}</p>

      <div className="history-card__meta">
        <span className="history-card__meta-chip">{resolvedMediaAssets.length} total</span>
        <span className="history-card__meta-chip">{mediaCounts.image} images</span>
        <span className="history-card__meta-chip">{mediaCounts.video} videos</span>
      </div>

      <UpdateMediaGallery layout="carousel" mediaAssets={resolvedMediaAssets} />
    </section>
  );
}

export function HistoryCompareModal({
  focusedHistoryEntry,
  historyEntries,
  onClose,
  plantName,
  treeId,
}) {
  const [leftEntryId, setLeftEntryId] = useState(normalizeHistoryEntryId(focusedHistoryEntry?.id));
  const [rightEntryId, setRightEntryId] = useState(normalizeHistoryEntryId(focusedHistoryEntry?.id));

  const compareSourceEntries = useMemo(() => {
    const normalizedFocusedId = normalizeHistoryEntryId(focusedHistoryEntry?.id);
    const baseEntries = Array.isArray(historyEntries) ? historyEntries : [];
    const hasFocusedEntry = baseEntries.some(
      (historyEntry) => normalizeHistoryEntryId(historyEntry?.id) === normalizedFocusedId,
    );

    if (!hasFocusedEntry && focusedHistoryEntry != null) {
      return [focusedHistoryEntry, ...baseEntries];
    }

    return baseEntries;
  }, [focusedHistoryEntry, historyEntries]);

  const compareOptions = useMemo(
    () =>
      compareSourceEntries.map((historyEntry) => ({
        id: normalizeHistoryEntryId(historyEntry?.id),
        label: buildCompareOptionLabel(historyEntry),
      })),
    [compareSourceEntries],
  );

  const leftHistoryEntry =
    findHistoryEntryById(compareSourceEntries, leftEntryId) ?? focusedHistoryEntry ?? null;
  const rightHistoryEntry =
    findHistoryEntryById(compareSourceEntries, rightEntryId) ?? focusedHistoryEntry ?? null;

  useEffect(() => {
    const focusedId = normalizeHistoryEntryId(focusedHistoryEntry?.id);
    setLeftEntryId(focusedId);
    setRightEntryId(focusedId);
  }, [focusedHistoryEntry?.id]);

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

  if (leftHistoryEntry == null || rightHistoryEntry == null) {
    return null;
  }

  return (
    <div className="compare-modal-backdrop" onClick={onClose}>
      <section
        aria-modal="true"
        className="compare-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="compare-modal__header">
          <div className="compare-modal__header-copy">
            <p className="history-drawer__eyebrow">Compare Reports</p>
            <h2>{treeId ?? "Tree comparison"}</h2>
            <p className="history-drawer__subtitle">{plantName ?? "Side-by-side orchard review"}</p>
          </div>

          <button className="history-drawer__close" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="compare-modal__grid">
          <div className="compare-modal__column">
            <label className="compare-modal__field">
              <span className="compare-modal__field-label">Left Panel</span>
              <select
                className="compare-modal__select"
                onChange={(event) => setLeftEntryId(event.target.value)}
                value={normalizeHistoryEntryId(leftHistoryEntry?.id)}
              >
                {compareOptions.map((compareOption) => (
                  <option key={compareOption.id || compareOption.label} value={compareOption.id}>
                    {compareOption.label}
                  </option>
                ))}
              </select>
            </label>

            <ComparePanel historyEntry={leftHistoryEntry} panelLabel="Left" />
          </div>

          <div className="compare-modal__column">
            <label className="compare-modal__field">
              <span className="compare-modal__field-label">Right Panel</span>
              <select
                className="compare-modal__select"
                onChange={(event) => setRightEntryId(event.target.value)}
                value={normalizeHistoryEntryId(rightHistoryEntry?.id)}
              >
                {compareOptions.map((compareOption) => (
                  <option key={compareOption.id || compareOption.label} value={compareOption.id}>
                    {compareOption.label}
                  </option>
                ))}
              </select>
            </label>

            <ComparePanel historyEntry={rightHistoryEntry} panelLabel="Right" />
          </div>
        </div>
      </section>
    </div>
  );
}
