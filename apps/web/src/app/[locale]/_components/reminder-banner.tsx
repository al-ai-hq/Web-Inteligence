"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function ReminderBanner({ days }: { days: number }) {
  const t = useTranslations("dashboard");
  const [dismissed, setDismissed] = useState(false);

  if (days < 14 || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-4 text-sm">
      <p>{t("reminder", { days })}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ms-4 text-neutral-500 underline"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
