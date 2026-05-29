import { ArrowLeftRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HistoryCompareModal } from "./HistoryCompareModal.jsx";
import { UpdateMediaGallery } from "./UpdateMediaGallery.jsx";

const NO_REPORT_NOTE = "No field report submitted yet.";
const NO_REPORT_UPDATED_AT = "No report yet";
const MONTH_GROUP_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

function resolveHistoryGroupMetadata(createdAtEpoch) {
  const groupDate =
    typeof createdAtEpoch === "number" && createdAtEpoch > 0 ? new Date(createdAtEpoch) : null;

  if (groupDate == null || Number.isNaN(groupDate.getTime())) {
    return {
      key: "unknown",
      label: "Unscheduled",
    };
  }

  return {
    key: `${groupDate.getUTCFullYear()}-${String(groupDate.getUTCMonth() + 1).padStart(2, "0")}`,
    label: MONTH_GROUP_FORMATTER.format(groupDate),
  };
}

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

function groupHistoryEntriesByMonth(historyEntries) {
  const groups = [];
  const groupIndexByKey = new Map();

  (Array.isArray(historyEntries) ? historyEntries : []).forEach((historyEntry) => {
    const { key: groupKey, label: groupLabel } = resolveHistoryGroupMetadata(
      historyEntry?.createdAtEpoch,
    );

    if (!groupIndexByKey.has(groupKey)) {
      groupIndexByKey.set(groupKey, groups.length);
      groups.push({
        entries: [],
        key: groupKey,
        label: groupLabel,
      });
    }

    groups[groupIndexByKey.get(groupKey)].entries.push(historyEntry);
  });

  return groups;
}

function findHistoryEntryById(historyEntries, historyEntryId) {
  if (historyEntryId == null) {
    return null;
  }

  return (
    (Array.isArray(historyEntries) ? historyEntries : []).find(
      (historyEntry) => historyEntry?.id === historyEntryId,
    ) ?? null
  );
}

export function TreeHistoryDrawer({
  historyEntries,
  latestHistoryEntry,
  onClose,
  reportRow,
  selectedTree,
}) {
  const drawerRef = useRef(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState(latestHistoryEntry?.id ?? null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isCompareModalOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCompareModalOpen, onClose]);

  useEffect(() => {
    setSelectedHistoryEntryId(latestHistoryEntry?.id ?? null);
  }, [latestHistoryEntry?.id]);

  const historyCount = Array.isArray(historyEntries) ? historyEntries.length : 0;
  const historyGroups = groupHistoryEntriesByMonth(historyEntries);
  const activeHistoryEntry =
    findHistoryEntryById(historyEntries, selectedHistoryEntryId) ?? latestHistoryEntry ?? null;
  const resolvedCondition =
    activeHistoryEntry?.condition ?? latestHistoryEntry?.condition ?? selectedTree?.condition ?? null;
  const resolvedBadgeStyle =
    activeHistoryEntry?.badgeStyle ??
    latestHistoryEntry?.badgeStyle ??
    reportRow?.badgeStyle ??
    resolvedCondition?.badgeStyle ??
    null;
  const resolvedConditionIcon =
    activeHistoryEntry?.conditionIcon ??
    latestHistoryEntry?.conditionIcon ??
    reportRow?.conditionIcon ??
    resolvedCondition?.icon ??
    "●";
  const resolvedConditionLabel =
    activeHistoryEntry?.kondisi ??
    latestHistoryEntry?.kondisi ??
    reportRow?.kondisi ??
    resolvedCondition?.label ??
    "Unknown";
  const resolvedTreeId = selectedTree?.treeIdDisplay ?? reportRow?.treeId ?? "Unknown";
  const resolvedPlantName = selectedTree?.plantName ?? reportRow?.plantName ?? "Unknown Plant";
  const resolvedPlantType = selectedTree?.plantType?.label ?? reportRow?.jenis ?? "Unknown";
  const resolvedUpdatedAt =
    activeHistoryEntry?.updatedAt ??
    latestHistoryEntry?.updatedAt ??
    reportRow?.updatedAt ??
    NO_REPORT_UPDATED_AT;
  const resolvedNote =
    activeHistoryEntry?.note ?? latestHistoryEntry?.note ?? reportRow?.note ?? NO_REPORT_NOTE;
  const mediaAssets = Array.isArray(activeHistoryEntry?.mediaAssets) ? activeHistoryEntry.mediaAssets : [];
  const mediaCounts = countMediaByKind(mediaAssets);
  const canOpenCompare = activeHistoryEntry != null && historyCount > 0;

  useEffect(() => {
    if (!canOpenCompare) {
      setIsCompareModalOpen(false);
    }
  }, [canOpenCompare]);

  const handleHistoryEntrySelect = (historyEntryId) => {
    setSelectedHistoryEntryId(historyEntryId);

    window.requestAnimationFrame(() => {
      drawerRef.current?.scrollTo({
        behavior: "smooth",
        top: 0,
      });
    });
  };

  if (reportRow == null && selectedTree == null) {
    return null;
  }

  return (
    <>
      <div className="history-drawer-backdrop" onClick={onClose}>
        <aside
          aria-labelledby="tree-history-drawer-title"
          aria-modal="true"
          className="history-drawer"
          onClick={(event) => event.stopPropagation()}
          ref={drawerRef}
          role="dialog"
        >
          <div className="history-drawer__header">
            <div className="history-drawer__header-copy">
              <h2 id="tree-history-drawer-title">{resolvedPlantName}</h2>
              <p className="history-drawer__subtitle">{resolvedTreeId}</p>
            </div>

            <div className="history-drawer__actions">
              <button
                className="history-drawer__action history-drawer__action--accent"
                disabled={!canOpenCompare}
                onClick={() => setIsCompareModalOpen(true)}
                type="button"
              >
                <ArrowLeftRight size={15} strokeWidth={2} />
                Compare
              </button>
              <button
                aria-label="Close tree history"
                className="history-drawer__close"
                onClick={onClose}
                type="button"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="history-drawer__summary">
            <span className="history-drawer__summary-chip">{resolvedPlantType}</span>
            <span className="history-drawer__summary-chip">
              {selectedTree != null ? "Mapped on canvas" : "No mapped coordinate"}
            </span>
            <span className="history-drawer__summary-chip">
              {historyCount === 1 ? "1 update loaded" : `${historyCount} updates loaded`}
            </span>
            {activeHistoryEntry != null ? (
              <span className="history-drawer__summary-chip">
                {activeHistoryEntry.id === latestHistoryEntry?.id
                  ? "Latest report focused"
                  : "Timeline report focused"}
              </span>
            ) : null}
          </div>

          <section className="history-drawer__section">
            <p className="history-drawer__label">Report Snapshot</p>
            <div className="history-drawer__status-row">
              <span className="status-badge" style={resolvedBadgeStyle ?? undefined}>
                {resolvedConditionIcon} {resolvedConditionLabel}
              </span>
              <span className="history-drawer__timestamp">{resolvedUpdatedAt}</span>
            </div>
          </section>

          <section className="history-drawer__section">
            <p className="history-drawer__label">Field Note</p>
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

          <section className="history-drawer__section">
            <p className="history-drawer__label">Update Timeline</p>

            {historyGroups.length === 0 ? (
              <div className="history-drawer__empty-state">
                <strong>No historical updates</strong>
                <span>
                  This tree is visible in monitoring, but no stored report history is attached yet.
                </span>
              </div>
            ) : (
              <div className="history-timeline">
                {historyGroups.map((historyGroup) => (
                  <div className="history-timeline__group" key={historyGroup.key}>
                    <div className="history-timeline__month">
                      <strong>{historyGroup.label}</strong>
                      <span>
                        {historyGroup.entries.length === 1
                          ? "1 update"
                          : `${historyGroup.entries.length} updates`}
                      </span>
                    </div>

                    <div className="history-timeline__entries">
                      {historyGroup.entries.map((historyEntry, index) => (
                        <button
                          className={`history-card history-card--interactive ${
                            activeHistoryEntry?.id === historyEntry.id ? "history-card--selected" : ""
                          }`}
                          key={historyEntry.id ?? `${historyGroup.key}-${index}`}
                          onClick={() => handleHistoryEntrySelect(historyEntry.id ?? null)}
                          type="button"
                        >
                          <div className="history-card__header">
                            <div className="history-card__status">
                              <span className="status-badge" style={historyEntry.badgeStyle ?? undefined}>
                                {historyEntry.conditionIcon ?? "●"} {historyEntry.kondisi}
                              </span>
                              {activeHistoryEntry?.id === historyEntry.id ? (
                                <span className="history-card__selected-chip">Selected</span>
                              ) : null}
                              {latestHistoryEntry?.id === historyEntry.id ? (
                                <span className="history-card__latest-chip">Latest</span>
                              ) : null}
                            </div>

                            <span className="history-card__timestamp">
                              {historyEntry.updatedAt ?? NO_REPORT_UPDATED_AT}
                            </span>
                          </div>

                          <p className="history-card__note">{historyEntry.note ?? NO_REPORT_NOTE}</p>

                          <div className="history-card__meta">
                            <span className="history-card__meta-chip">
                              {historyEntry.mediaCount > 0 ? `${historyEntry.mediaCount} media` : "No media"}
                            </span>
                            <span className="history-card__meta-chip">
                              {historyEntry.jenis ?? resolvedPlantType}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {isCompareModalOpen ? (
        <HistoryCompareModal
          focusedHistoryEntry={activeHistoryEntry}
          historyEntries={historyEntries}
          onClose={() => setIsCompareModalOpen(false)}
          plantName={resolvedPlantName}
          treeId={resolvedTreeId}
        />
      ) : null}
    </>
  );
}
