"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/auth?action=logout", { method: "POST" });
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void handleSignOut()} className="text-sm">
      {t("sign_out")}
    </button>
  );
}
