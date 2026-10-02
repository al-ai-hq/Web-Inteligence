import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages.methodology" });
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p>{t("p1")}</p>
      <p>{t("p2")}</p>
      <p>{t("p3")}</p>
    </article>
  );
}
