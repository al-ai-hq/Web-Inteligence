import { getTranslations } from "next-intl/server";

export default async function LocaleNotFound() {
  const t = await getTranslations("error");
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-neutral-600">{t("not_found")}</p>
    </div>
  );
}
