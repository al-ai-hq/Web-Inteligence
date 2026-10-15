import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "../_components/reset-password-form";

function normalizeToken(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  return <ResetPasswordForm token={normalizeToken(token)} />;
}
