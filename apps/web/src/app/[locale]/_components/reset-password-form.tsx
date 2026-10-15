"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "../../../i18n/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(t(`error_${body?.error ?? "generic"}`));
        return;
      }
      setDone(true);
    } catch {
      setError(t("error_generic"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClasses =
    "mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-900 shadow-sm outline-none transition-all placeholder:text-surface-700/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
  const labelClasses = "block text-sm font-medium text-surface-800";

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-surface-200 bg-white p-6 shadow-lg shadow-surface-200/50 sm:p-8"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-surface-900">{t("reset_password_title")}</h1>
          <div className="h-1 w-12 rounded-full bg-brand-500" />
        </div>
        {done ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {t("reset_success")}
            </div>
            <Link
              href={`/${locale}/login`}
              className="block w-full rounded-xl bg-brand-600 px-6 py-3 text-center font-semibold text-white hover:bg-brand-700"
            >
              {t("sign_in")}
            </Link>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="password" className={labelClasses}>
                {t("password_label")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClasses}
              />
            </div>
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? t("submitting") : t("reset_password_button")}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
