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

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">
        {t(mode === "signup" ? "signup_title" : "login_title")}
      </h1>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("email_label")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {t("password_label")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>
      {mode === "signup" ? (
        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium">
            {t("confirm_password_label")}
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting
          ? t(mode === "signup" ? "sign_up" : "sign_in")
          : t(mode === "signup" ? "sign_up" : "sign_in")}
      </button>
      <p className="text-sm text-neutral-600">
        {mode === "signup" ? (
          <>
            {t("have_account")}{" "}
            <Link href="/login" className="underline">
              {t("sign_in")}
            </Link>
          </>
        ) : (
          <>
            {t("need_account")}{" "}
            <Link href="/signup" className="underline">
              {t("sign_up")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
