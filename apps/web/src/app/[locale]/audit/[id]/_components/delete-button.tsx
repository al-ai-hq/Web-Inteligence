"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "../../../../../i18n/navigation";

export function DeleteButton({
  auditId,
  secret,
}: {
  auditId: string;
  secret: string;
}) {
  const t = useTranslations("report");
  const router = useRouter();
  const [error, setError] = useState(false);

  async function handleDelete(): Promise<void> {
    if (!window.confirm(t("delete_confirm"))) {
      return;
    }
    setError(false);
    const response = await fetch(
      `/api/audits/${auditId}?s=${encodeURIComponent(secret)}`,
      { method: "DELETE" },
    );
    if (response.status === 204) {
      router.replace("/");
      router.refresh();
      return;
    }
    setError(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleDelete()}
        className="text-sm text-red-600 underline"
      >
        {t("delete_audit")}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{t("delete_failed")}</p>}
    </div>
  );
}
