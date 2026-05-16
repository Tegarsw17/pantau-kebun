import { useEffect, useMemo, useState } from "react";
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
  const [detailMode, setDetailMode] = useState("latest");
  const [selectedCompareGroupKey, setSelectedCompareGroupKey] = useState("");
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState(latestHistoryEntry?.id ?? null);

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

  const historyCount = Array.isArray(historyEntries) ? historyEntries.length : 0;
  const historyGroups = groupHistoryEntriesByMonth(historyEntries);
  const activeHistoryEntry =
    findHistoryEntryById(historyEntries, selectedHistoryEntryId) ?? latestHistoryEntry ?? null;
  const activeHistoryGroupKey = resolveHistoryGroupMetadata(activeHistoryEntry?.createdAtEpoch).key;
  const activeHistoryGroupIndex = historyGroups.findIndex(
    (historyGroup) => historyGroup.key === activeHistoryGroupKey,
  );
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
    activeHistoryEntry?.updatedAt ?? latestHistoryEntry?.updatedAt ?? reportRow?.updatedAt ?? NO_REPORT_UPDATED_AT;
  const resolvedNote = activeHistoryEntry?.note ?? latestHistoryEntry?.note ?? reportRow?.note ?? NO_REPORT_NOTE;
  const mediaAssets = Array.isArray(activeHistoryEntry?.mediaAssets) ? activeHistoryEntry.mediaAssets : [];
  const mediaCounts = countMediaByKind(mediaAssets);
  const comparisonOptions = useMemo(
    () => {
      const comparisonStartIndex = activeHistoryGroupIndex >= 0 ? activeHistoryGroupIndex + 1 : 1;

      return historyGroups.slice(comparisonStartIndex).map((historyGroup) => ({
        key: historyGroup.key,
        label: historyGroup.label,
        snapshotEntry: historyGroup.entries[0] ?? null,
        updateCount: historyGroup.entries.length,
      }));
    },
    [activeHistoryGroupIndex, historyGroups],
  );
  const selectedCompareOption =
    comparisonOptions.find((comparisonOption) => comparisonOption.key === selectedCompareGroupKey) ??
    comparisonOptions[0] ??
    null;
  const comparisonEntry = selectedCompareOption?.snapshotEntry ?? null;
  const comparisonMediaAssets = Array.isArray(comparisonEntry?.mediaAssets)
    ? comparisonEntry.mediaAssets
    : [];
  const comparisonMediaCounts = countMediaByKind(comparisonMediaAssets);

  useEffect(() => {
    setSelectedHistoryEntryId(latestHistoryEntry?.id ?? null);
  }, [latestHistoryEntry?.id]);

  useEffect(() => {
    if (comparisonOptions.length === 0) {
      setSelectedCompareGroupKey("");
      if (detailMode === "compare") {
        setDetailMode("latest");
      }
      return;
    }

    const hasSelectedCompareOption = comparisonOptions.some(
      (comparisonOption) => comparisonOption.key === selectedCompareGroupKey,
    );

    if (!hasSelectedCompareOption) {
      setSelectedCompareGroupKey(comparisonOptions[0].key);
    }
  }, [comparisonOptions, detailMode, selectedCompareGroupKey]);

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
          {activeHistoryEntry != null ? (
            <span className="history-drawer__summary-chip">
              {activeHistoryEntry.id === latestHistoryEntry?.id ? "Latest report focused" : "Timeline report focused"}
            </span>
          ) : null}
        </div>

        <div className="history-drawer__mode-switch" role="tablist" aria-label="Tree detail mode">
          <button
            aria-selected={detailMode === "latest"}
            className={`history-drawer__mode-button ${
              detailMode === "latest" ? "history-drawer__mode-button--active" : ""
            }`}
            onClick={() => setDetailMode("latest")}
            role="tab"
            type="button"
          >
            Latest
          </button>
          <button
            aria-selected={detailMode === "compare"}
            className={`history-drawer__mode-button ${
              detailMode === "compare" ? "history-drawer__mode-button--active" : ""
            }`}
            disabled={comparisonOptions.length === 0}
            onClick={() => setDetailMode("compare")}
            role="tab"
            type="button"
          >
            Compare
          </button>
        </div>

        {detailMode === "compare" ? (
          <section className="history-drawer__section">
            <p className="history-drawer__label">Monthly Compare</p>

            {comparisonOptions.length === 0 ? (
              <div className="history-drawer__empty-state">
                <strong>No earlier month available</strong>
                <span>This focused report does not have an earlier comparison month yet.</span>
              </div>
            ) : (
              <>
                <label className="history-drawer__compare-field">
                  <span className="history-drawer__compare-label">Compare Against</span>
                  <select
                    className="history-drawer__compare-select"
                    onChange={(event) => setSelectedCompareGroupKey(event.target.value)}
                    value={selectedCompareOption?.key ?? ""}
                  >
                    {comparisonOptions.map((comparisonOption) => (
                      <option key={comparisonOption.key} value={comparisonOption.key}>
                        {comparisonOption.label} ({comparisonOption.updateCount} updates)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="history-compare">
                  <section className="history-compare__panel">
                    <div className="history-compare__panel-header">
                      <strong>{activeHistoryEntry?.id === latestHistoryEntry?.id ? "Latest" : "Selected"}</strong>
                      <span>{resolvedUpdatedAt}</span>
                    </div>
                    <span className="status-badge" style={resolvedBadgeStyle ?? undefined}>
                      {resolvedConditionIcon} {resolvedConditionLabel}
                    </span>
                    <p className="history-compare__note">{resolvedNote}</p>
                    <div className="history-card__meta">
                      <span className="history-card__meta-chip">{mediaAssets.length} total</span>
                      <span className="history-card__meta-chip">{mediaCounts.image} images</span>
                      <span className="history-card__meta-chip">{mediaCounts.video} videos</span>
                    </div>
                    <UpdateMediaGallery mediaAssets={mediaAssets} />
                  </section>

                  <section className="history-compare__panel">
                    <div className="history-compare__panel-header">
                      <strong>{selectedCompareOption?.label ?? "Earlier Month"}</strong>
                      <span>{comparisonEntry?.updatedAt ?? NO_REPORT_UPDATED_AT}</span>
                    </div>
                    <span className="status-badge" style={comparisonEntry?.badgeStyle ?? undefined}>
                      {comparisonEntry?.conditionIcon ?? "●"}{" "}
                      {comparisonEntry?.kondisi ?? "No historical report"}
                    </span>
                    <p className="history-compare__note">
                      {comparisonEntry?.note ?? "No report stored for the selected comparison month."}
                    </p>
                    <div className="history-card__meta">
                      <span className="history-card__meta-chip">
                        {comparisonMediaAssets.length} total
                      </span>
                      <span className="history-card__meta-chip">
                        {comparisonMediaCounts.image} images
                      </span>
                      <span className="history-card__meta-chip">
                        {comparisonMediaCounts.video} videos
                      </span>
                    </div>
                    <UpdateMediaGallery mediaAssets={comparisonMediaAssets} />
                  </section>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
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
          </>
        )}

        <section className="history-drawer__section">
          <p className="history-drawer__label">Update Timeline</p>

          {historyGroups.length === 0 ? (
            <div className="history-drawer__empty-state">
              <strong>No historical updates</strong>
              <span>This tree is visible in monitoring, but no stored report history is attached yet.</span>
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
                        onClick={() => setSelectedHistoryEntryId(historyEntry.id ?? null)}
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
                            {historyEntry.mediaCount > 0
                              ? `${historyEntry.mediaCount} media`
                              : "No media"}
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
  );
}
