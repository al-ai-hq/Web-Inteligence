import { getTranslations } from "next-intl/server";
import type { RuleCategory, ScoreResult } from "@wpi/rules-engine";

export function formatScorePercentage(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value)}%`;
}

export function categoryLabelKey(category: RuleCategory): string {
  return `score_category_${category}`;
}

function scoreTone(value: number | null): string {
  if (value === null) return "text-surface-700";
  if (value >= 80) return "text-emerald-600";
  if (value >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBarColor(value: number | null): string {
  if (value === null) return "bg-surface-200";
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-amber-500";
  return "bg-red-500";
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
    <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-surface-900">{t("score_title")}</h2>
          <p className={`text-5xl font-bold ${scoreTone(score.presence_readiness)}`}>
            {formatScorePercentage(score.presence_readiness)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1 text-surface-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t("score_confidence")}: {t(`confidence_${score.confidence}`)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1 text-surface-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {t("score_coverage")}: {formatScorePercentage(score.coverage * 100)}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-surface-800">{t("score_categories")}</h3>
        <ul className="space-y-3">
          {score.categories.map((cat) => (
            <li key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-surface-800">{t(categoryLabelKey(cat.category))}</span>
                <span className={`font-semibold ${scoreTone(cat.value)}`}>{formatScorePercentage(cat.value)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                <div
                  className={`h-full rounded-full transition-all ${scoreBarColor(cat.value)}`}
                  style={{ width: `${cat.value ?? 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {score.applied_caps.length > 0 ? (
        <div className="mt-6 space-y-2 rounded-xl bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800">{t("score_caps")}</h3>
          <ul className="space-y-1 text-sm text-amber-700">
            {score.applied_caps.map((cap) => (
              <li key={cap.cap_id} className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {t("score_caps_detail", { cap: cap.reason_key, max: cap.max_score })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
