"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "../../../i18n/navigation";

interface MobileNavProps {
  user: { email: string } | null;
}

export function MobileNav({ user }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed right-4 top-3 z-[100] rounded-lg p-2 text-surface-700 transition-colors hover:bg-surface-100"
        aria-label={open ? t("close_menu") : t("open_menu")}
        aria-expanded={open}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[65px] z-[99] border-b border-surface-200/60 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-6 py-4">
            <Link
              href="/methodology"
              className="rounded-lg px-3 py-3 text-surface-700 transition-colors hover:bg-surface-100"
              onClick={() => setOpen(false)}
            >
              {t("methodology")}
            </Link>
            <Link
              href="/privacy"
              className="rounded-lg px-3 py-3 text-surface-700 transition-colors hover:bg-surface-100"
              onClick={() => setOpen(false)}
            >
              {t("privacy")}
            </Link>
            <Link
              href="/terms"
              className="rounded-lg px-3 py-3 text-surface-700 transition-colors hover:bg-surface-100"
              onClick={() => setOpen(false)}
            >
              {t("terms")}
            </Link>
            <div className="my-2 h-px bg-surface-200" />
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-3 text-surface-700 transition-colors hover:bg-surface-100"
                  onClick={() => setOpen(false)}
                >
                  {t("dashboard")}
                </Link>
                <span className="truncate px-3 py-2 text-sm text-surface-600" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await fetch("/api/auth?action=logout", { method: "POST" });
                      window.location.href = `/${locale}`;
                    })();
                    setOpen(false);
                  }}
                  className="rounded-lg px-3 py-3 text-left text-surface-700 transition-colors hover:bg-surface-100"
                >
                  {t("sign_out")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-3 text-surface-700 transition-colors hover:bg-surface-100"
                  onClick={() => setOpen(false)}
                >
                  {t("sign_in")}
                </Link>
                <Link
                  href="/signup"
                  className="mt-2 rounded-lg bg-brand-600 px-4 py-3 text-center font-medium text-white shadow-sm transition-all hover:bg-brand-700"
                  onClick={() => setOpen(false)}
                >
                  {t("sign_up")}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
