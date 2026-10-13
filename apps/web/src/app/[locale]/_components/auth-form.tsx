"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "../../../i18n/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirm_password") ?? "");

    if (mode === "signup" && password !== confirmPassword) {
      setError(t("error_password_mismatch"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: Record<string, string> = { email, password };
    if (mode === "signup") {
      body["confirm_password"] = confirmPassword;
    }

    let response: Response;
    try {
      response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError(t("error_generic"));
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(t(`error_${responseBody?.error ?? "generic"}`));
      setSubmitting(false);
      return;
    }

    window.location.assign(`/${locale}/dashboard`);
  }

  const inputClasses =
    "mt-1.5 w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-surface-900 shadow-sm outline-none transition-all placeholder:text-surface-700/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-100";
  const labelClasses = "block text-sm font-medium text-surface-800";

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-surface-200 bg-white p-6 shadow-lg shadow-surface-200/50 sm:p-8">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-surface-900">
            {t(mode === "signup" ? "signup_title" : "login_title")}
          </h1>
          <div className="h-1 w-12 rounded-full bg-brand-500" />
        </div>

        <div>
          <label htmlFor="email" className={labelClasses}>
            {t("email_label")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClasses}>
            {t("password_label")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={inputClasses}
          />
        </div>
        {mode === "signup" ? (
          <div>
            <label htmlFor="confirm_password" className={labelClasses}>
              {t("confirm_password_label")}
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              autoComplete="new-password"
              className={inputClasses}
            />
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
            t(mode === "signup" ? "sign_up" : "sign_in")
          )}
        </button>

        <p className="text-center text-sm text-surface-700">
          {mode === "signup" ? (
            <>
              {t("have_account")}{" "}
              <Link href="/login" className="font-medium text-brand-600 transition-colors hover:text-brand-700">
                {t("sign_in")}
              </Link>
            </>
          ) : (
            <>
              {t("need_account")}{" "}
              <Link href="/signup" className="font-medium text-brand-600 transition-colors hover:text-brand-700">
                {t("sign_up")}
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
