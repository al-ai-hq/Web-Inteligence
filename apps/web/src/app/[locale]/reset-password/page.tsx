import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "../_components/reset-password-form";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);
  return <ResetPasswordForm token={token ?? ""} />;
}
