"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 3000;

export function isTerminalPollStatus(status: number): boolean {
  return status === 404 || status === 410;
}

const STAGES = [
  "QUEUED",
  "VALIDATING",
  "CRAWLING",
  "EXTRACTING",
  "AUDITING",
  "COMPOSING",
] as const;

export function StatusPoller({
  auditId,
  secret,
}: {
  auditId: string;
  secret: string;
}) {
  const t = useTranslations("status");
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/audits/${auditId}/status?s=${encodeURIComponent(secret)}`,
            { cache: "no-store" },
          );
          if (isTerminalPollStatus(response.status)) {
            stopped = true;
            clearInterval(interval);
            router.replace("/");
            return;
          }
          if (!response.ok || stopped) {
            return;
          }
          const body = (await response.json()) as {
            status: string;
            has_report: boolean;
          };
          if (stopped) {
            return;
          }
          setCurrentStatus(body.status);
          if (body.has_report || body.status === "FAILED") {
            stopped = true;
            clearInterval(interval);
            router.refresh();
          }
        } catch {
          // Transient fetch failure; the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [auditId, router, secret]);

  const currentIndex = currentStatus !== null ? STAGES.indexOf(currentStatus as (typeof STAGES)[number]) : -1;

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16" aria-live="polite">
      <div className="mx-auto max-w-lg space-y-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
          <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-surface-900">{t("title")}</h1>
          <p className="text-surface-700">{t("subtitle")}</p>
        </div>
        <ol className="flex flex-wrap justify-center gap-2">
          {STAGES.map((stage, index) => {
            const isComplete = index < currentIndex;
            const isActive = index === currentIndex;
            return (
              <li
                key={stage}
                aria-current={isActive ? "step" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  isComplete
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                      : "bg-surface-100 text-surface-700"
                }`}
              >
                {isComplete ? (
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t(`stage_${stage}`)}
                  </span>
                ) : (
                  t(`stage_${stage}`)
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
