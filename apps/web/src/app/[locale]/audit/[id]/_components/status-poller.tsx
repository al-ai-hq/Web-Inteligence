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
    <div className="space-y-6 py-16 text-center" aria-live="polite">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-neutral-600">{t("subtitle")}</p>
      <ol className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            aria-current={index <= currentIndex ? "step" : undefined}
            className={
              index <= currentIndex
                ? "rounded-full bg-neutral-900 px-3 py-1 text-sm text-white"
                : "rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-500"
            }
          >
            {t(`stage_${stage}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}
