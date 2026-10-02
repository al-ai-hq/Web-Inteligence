"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { submitAudit } from "./create-audit-client";

export function AuditForm() {
  const t = useTranslations("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") ?? "").trim();
    const competitors = String(form.get("competitors") ?? "").trim();
    const targetKeywords = String(form.get("target_keywords") ?? "")
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0)
      .slice(0, 10);
    const locale = document.documentElement.lang === "ar" ? "ar" : "en";

    const result = await submitAudit({
      url,
      locale,
      context: {
        organization: String(form.get("organization") ?? ""),
        business_type: String(form.get("business_type") ?? ""),
        offering: String(form.get("offering") ?? ""),
        market: String(form.get("market") ?? ""),
        customer_language: String(form.get("customer_language") ?? ""),
        audience: String(form.get("audience") ?? ""),
        ...(competitors.length > 0 ? { competitors } : {}),
        ...(targetKeywords.length > 0 ? { target_keywords: targetKeywords } : {}),
      },
    });

    if (result.ok) {
      window.location.assign(
        `${result.data.status_url}?s=${encodeURIComponent(result.data.secret)}`,
      );
      return;
    }
    setError(t(`error_${result.error}`));
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <div>
        <label htmlFor="url" className="block text-sm font-medium">
          {t("url_label")}
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder={t("url_placeholder")}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="organization" className="block text-sm font-medium">
            {t("organization")}
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="business_type" className="block text-sm font-medium">
            {t("business_type")}
          </label>
          <input
            id="business_type"
            name="business_type"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="offering" className="block text-sm font-medium">
            {t("offering")}
          </label>
          <input
            id="offering"
            name="offering"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="market" className="block text-sm font-medium">
            {t("market")}
          </label>
          <input
            id="market"
            name="market"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="customer_language" className="block text-sm font-medium">
            {t("customer_language")}
          </label>
          <input
            id="customer_language"
            name="customer_language"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="audience" className="block text-sm font-medium">
            {t("audience")}
          </label>
          <input
            id="audience"
            name="audience"
            type="text"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label htmlFor="competitors" className="block text-sm font-medium">
          {t("competitors")}
        </label>
        <input
          id="competitors"
          name="competitors"
          type="text"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="target_keywords" className="block text-sm font-medium">
          {t("target_keywords")}
        </label>
        <input
          id="target_keywords"
          name="target_keywords"
          type="text"
          aria-describedby="target_keywords_hint"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
        <p id="target_keywords_hint" className="mt-1 text-sm text-neutral-500">
          {t("target_keywords_hint")}
        </p>
      </div>
      {error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
