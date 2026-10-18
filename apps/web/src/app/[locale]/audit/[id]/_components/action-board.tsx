"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StoredActionItem } from "@wpi/audit-pipeline";
import type { RecommendationBand } from "@wpi/rules-engine";

export const BAND_ORDER: readonly RecommendationBand[] = [
  "quick_win",
  "strategic",
  "fill_in",
  "defer",
];

const BAND_BADGE_CLASSES: Record<RecommendationBand, string> = {
  quick_win: "bg-emerald-100 text-emerald-800",
  strategic: "bg-brand-100 text-brand-800",
  fill_in: "bg-amber-100 text-amber-800",
  defer: "bg-surface-200 text-surface-700",
};

const SEVERITY_CLASSES: Record<StoredActionItem["severity"], string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
  info: "bg-surface-100 text-surface-700",
};

export interface BandGroup {
  band: RecommendationBand | null;
  items: StoredActionItem[];
}

/**
 * Agent-derived rows carry a null band; they are grouped last rather than
 * dropped, so the board never hides a recommendation the composer produced.
 */
export function groupByBand(items: StoredActionItem[]): BandGroup[] {
  const groups: BandGroup[] = BAND_ORDER.map((band) => ({
    band,
    items: items.filter((item) => item.band === band),
  }));
  const unscored = items.filter((item) => item.band === null);
  if (unscored.length > 0) {
    groups.push({ band: null, items: unscored });
  }
  return groups.filter((group) => group.items.length > 0);
}

/** A 1-10 score collapsed onto five segments; null scores have no meter. */
export function scoreSegments(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(5, Math.round(value / 2)));
}

export function applyPath(auditId: string, findingId: string): string {
  return `/api/audits/${encodeURIComponent(auditId)}/recommendations/${encodeURIComponent(
    findingId,
  )}/apply`;
}

function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  const segments = scoreSegments(value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-surface-700">{label}</span>
      {segments === null ? (
        <span className="text-xs text-surface-500">{"\u2014"}</span>
      ) : (
        <span className="flex items-center gap-1" aria-label={`${label}: ${value}/10`}>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                index < segments ? "bg-brand-500" : "bg-surface-200"
              }`}
            />
          ))}
          <span className="text-xs tabular-nums text-surface-700">{value}</span>
        </span>
      )}
    </div>
  );
}

export function ActionBoard({
  items,
  auditId,
  isOwner,
  appliedRuleIds,
}: {
  items: StoredActionItem[];
  auditId: string;
  isOwner: boolean;
  appliedRuleIds: string[];
}) {
  const t = useTranslations("report");
  const [applied, setApplied] = useState<Set<string>>(() => new Set(appliedRuleIds));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  async function markApplied(findingId: string, ruleId: string): Promise<void> {
    setBusyId(findingId);
    setFailedId(null);
    try {
      const response = await fetch(applyPath(auditId, findingId), { method: "POST" });
      if (!response.ok) {
        setFailedId(findingId);
        return;
      }
      setApplied((previous) => new Set(previous).add(ruleId));
    } catch {
      setFailedId(findingId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-8">
      {groupByBand(items).map((group) => (
        <div key={group.band ?? "unscored"} className="space-y-3">
          <h3 className="text-lg font-semibold text-surface-900">
            {t(group.band === null ? "band_unscored" : `band_${group.band}`)}
          </h3>
          <ol className="space-y-3">
            {group.items.map((item) => {
              const isApplied = applied.has(item.title);
              return (
                <li
                  key={item.source_finding_id}
                  className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {group.band !== null ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BAND_BADGE_CLASSES[group.band]}`}
                      >
                        {t(`band_${group.band}`)}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[item.severity]}`}
                    >
                      {t(`severity_${item.severity}`)}
                    </span>
                    <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">
                      {t(`confidence_${item.confidence}`)}
                    </span>
                  </div>

                  <p className="mt-3 font-semibold text-surface-900">
                    <bdi>{item.title}</bdi>
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-surface-700">{item.detail}</p>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    <ScoreMeter label={t("indicator_impact")} value={item.impact_score} />
                    <ScoreMeter label={t("indicator_effort")} value={item.effort_score} />
                    <ScoreMeter label={t("indicator_timeline")} value={item.timeline_score} />
                  </div>

                  {isOwner ? (
                    <div className="mt-4">
                      {isApplied ? (
                        <p className="text-sm font-medium text-emerald-600">
                          {t("applied_pending")}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === item.source_finding_id}
                          onClick={() => void markApplied(item.source_finding_id, item.title)}
                          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-surface-200 disabled:text-surface-700"
                        >
                          {busyId === item.source_finding_id ? t("marking") : t("mark_applied")}
                        </button>
                      )}
                      {failedId === item.source_finding_id ? (
                        <p className="mt-2 text-sm text-red-600">{t("mark_failed")}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
