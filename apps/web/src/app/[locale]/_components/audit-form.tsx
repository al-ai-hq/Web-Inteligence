"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { submitAudit } from "./create-audit-client";

export function AuditForm() {
  const t = useTranslations("form");
  const rateLimitT = useTranslations("rateLimit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileSubmitted, setTurnstileSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setError(null);
    setSubmitting(true);

    const token = turnstileToken ?? undefined;
    if (token) {
      setTurnstileSubmitted(true);
    }

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
      turnstileToken: token,
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
        result.data.redirect_url
          ? result.data.redirect_url
          : `${result.data.status_url}?s=${encodeURIComponent(result.data.secret)}`,
      );
      return;
    }
    if (result.error === "turnstile_required") {
      setTurnstileRequired(true);
      if (token) {
        setError(rateLimitT("turnstileFailed"));
      }
      setSubmitting(false);
      return;
    }
    setError(t(`error_${result.error}`));
    setSubmitting(false);
  }

  const inputClasses =
    "mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-900 shadow-sm outline-none transition-all placeholder:text-surface-700/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 focus-visible:outline-none";
  const labelClasses = "block text-sm font-medium text-surface-800";

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-surface-200 bg-white p-6 shadow-lg shadow-surface-200/50 sm:p-8"
      >
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-surface-900">{t("title")}</h2>
          <div className="h-1 w-12 rounded-full bg-brand-500" />
          <p className="text-sm text-surface-700">
            Enter your website URL and business details to get started.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-surface-200/60 bg-surface-50/50 p-4 sm:p-5">
          <div>
            <label htmlFor="url" className={labelClasses}>
              {t("url_label")}
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder={t("url_placeholder")}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-surface-700">Business Details</span>
            <div className="h-px flex-1 bg-surface-200" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="organization" className={labelClasses}>
                {t("organization")}
              </label>
              <input
                id="organization"
                name="organization"
                type="text"
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="business_type" className={labelClasses}>
                {t("business_type")}
              </label>
              <input
                id="business_type"
                name="business_type"
                type="text"
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="offering" className={labelClasses}>
                {t("offering")}
              </label>
              <input
                id="offering"
                name="offering"
                type="text"
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="market" className={labelClasses}>
                {t("market")}
              </label>
              <input
                id="market"
                name="market"
                type="text"
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="customer_language" className={labelClasses}>
                {t("customer_language")}
              </label>
              <input
                id="customer_language"
                name="customer_language"
                type="text"
                required
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="audience" className={labelClasses}>
                {t("audience")}
              </label>
              <input
                id="audience"
                name="audience"
                type="text"
                required
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-surface-700">Optional</span>
            <div className="h-px flex-1 bg-surface-200" />
          </div>
          <div>
            <label htmlFor="competitors" className={labelClasses}>
              {t("competitors")}
            </label>
            <input
              id="competitors"
              name="competitors"
              type="text"
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="target_keywords" className={labelClasses}>
              {t("target_keywords")}
            </label>
            <input
              id="target_keywords"
              name="target_keywords"
              type="text"
              aria-describedby="target_keywords_hint"
              className={inputClasses}
            />
            <p id="target_keywords_hint" className="mt-1.5 text-xs text-surface-700">
              {t("target_keywords_hint")}
            </p>
          </div>
        </div>

        {error !== null ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        ) : null}

        {turnstileRequired ? (
          <div className="flex justify-center">
            <Turnstile
              siteKey={process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? ""}
              onSuccess={(token) => setTurnstileToken(token)}
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || (turnstileRequired && turnstileToken === null)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t("submitting")}
            </>
          ) : (
            <>
              {t("submit")}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
