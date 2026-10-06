import { getTranslations } from "next-intl/server";
import { Link } from "../../../../../i18n/navigation";

export async function MethodologyDisclosure({
  locale,
}: {
  locale: string;
}): Promise<React.JSX.Element> {
  const t = await getTranslations({ locale, namespace: "methodology_disclosure" });

  return (
    <details className="rounded border border-neutral-200 bg-neutral-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-700">
        {t("title")}
      </summary>
      <div className="space-y-4 px-4 pb-4 text-sm text-neutral-600">
        <p>{t("summary")}</p>

        <div className="space-y-1">
          <p className="font-medium text-neutral-700">{t("verification_title")}</p>
          <ul className="list-disc space-y-0.5 ps-5">
            <li>{t("verification_verified")}</li>
            <li>{t("verification_inferred")}</li>
            <li>{t("verification_not_verified")}</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-neutral-700">{t("confidence_title")}</p>
          <ul className="list-disc space-y-0.5 ps-5">
            <li>{t("confidence_high")}</li>
            <li>{t("confidence_medium")}</li>
            <li>{t("confidence_low")}</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-neutral-700">{t("scoring_title")}</p>
          <p>{t("scoring_body")}</p>
        </div>

        <div className="space-y-1">
          <p className="font-medium text-neutral-700">{t("evidence_title")}</p>
          <p>{t("evidence_body")}</p>
        </div>

        <p className="text-neutral-500">{t("sample_note")}</p>

        <p>
          <Link href="/methodology" className="text-sm underline">
            {t("full_methodology")}
          </Link>
        </p>
      </div>
    </details>
  );
}
