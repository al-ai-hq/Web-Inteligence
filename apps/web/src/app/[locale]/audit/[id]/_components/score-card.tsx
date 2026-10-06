import { getTranslations } from "next-intl/server";
import type { RuleCategory, ScoreResult } from "@wpi/rules-engine";

/**
 * Format a score value as a percentage string, or "N/A" when null.
 */
export function formatScorePercentage(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value)}%`;
}

/**
 * Map a RuleCategory to its i18n key under the "report" namespace.
 */
export function categoryLabelKey(category: RuleCategory): string {
  return `score_category_${category}`;
}

export async function ScoreCard({
  score,
  locale,
}: {
  score: ScoreResult;
  locale: string;
}): Promise<React.JSX.Element> {
  const t = await getTranslations({ locale, namespace: "report" });

  return (
    <section className="space-y-4 rounded border border-neutral-200 p-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t("score_title")}</h2>
        <p className="text-4xl font-bold">
          {formatScorePercentage(score.presence_readiness)}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
        <span>
          {t("score_confidence")}:{" "}
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
            {t(`confidence_${score.confidence}`)}
          </span>
        </span>
        <span>
          {t("score_coverage")}: {formatScorePercentage(score.coverage * 100)}
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-700">{t("score_categories")}</h3>
        <ul className="space-y-1 text-sm">
          {score.categories.map((cat) => (
            <li key={cat.category} className="flex items-center justify-between">
              <span className="text-neutral-700">{t(categoryLabelKey(cat.category))}</span>
              <span className="font-medium">{formatScorePercentage(cat.value)}</span>
            </li>
          ))}
        </ul>
      </div>

      {score.applied_caps.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-700">{t("score_caps")}</h3>
          <ul className="list-disc space-y-0.5 ps-6 text-sm text-neutral-600">
            {score.applied_caps.map((cap) => (
              <li key={cap.cap_id}>
                {t("score_caps_detail", { cap: cap.reason_key, max: cap.max_score })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
