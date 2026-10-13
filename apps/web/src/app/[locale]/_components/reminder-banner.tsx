"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function ReminderBanner({ days }: { days: number }) {
  const t = useTranslations("dashboard");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("wpi-reminder-dismissed") === today) {
      setDismissed(true);
    }
  }, []);

  if (days < 14 || dismissed) {
    return null;
  }

  function handleDismiss() {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("wpi-reminder-dismissed", today);
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-4 text-sm">
      <p>{t("reminder", { days })}</p>
      <button
        type="button"
        onClick={handleDismiss}
        className="ms-4 text-neutral-500 underline"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
