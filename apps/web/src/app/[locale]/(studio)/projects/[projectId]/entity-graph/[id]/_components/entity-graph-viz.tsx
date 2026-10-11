"use client";

import type {
  FactSheet,
  PublicSourceObservation,
  ProfileObservation,
  NapObservation,
} from "@wpi/footprint-store";
import { useTranslations } from "next-intl";

interface EntityGraphVizProps {
  factSheet: FactSheet;
  publicSources: PublicSourceObservation[];
  profiles: ProfileObservation[];
  napObservations: NapObservation[];
}

export function EntityGraphViz({
  factSheet,
  publicSources,
  profiles,
  napObservations,
}: EntityGraphVizProps) {
  const t = useTranslations("entity-graph");

  return (
    <div className="space-y-8">
      {/* Fact Sheet (center node) */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 mb-3">
          {t("confirmed_fact_sheet")}
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">{t("name")}:</dt>
          <dd className="font-medium">{factSheet.business_name}</dd>
          {factSheet.phone && (
            <>
              <dt className="text-gray-500">{t("phone")}:</dt>
              <dd>{factSheet.phone}</dd>
            </>
          )}
          {factSheet.email && (
            <>
              <dt className="text-gray-500">{t("email")}:</dt>
              <dd>{factSheet.email}</dd>
            </>
          )}
          {factSheet.address_line1 && (
            <>
              <dt className="text-gray-500">{t("address")}:</dt>
              <dd>
                {factSheet.address_line1}, {factSheet.address_locality}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Public Sources */}
      {publicSources.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">
            {t("discovered_sources")} ({publicSources.length})
          </h3>
          <div className="grid gap-2">
            {publicSources.map((source) => (
              <div
                key={source.id}
                className="bg-gray-50 border rounded p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">
                    {source.source_platform}
                  </span>
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {t("view_source")} &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Observations */}
      {profiles.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">
            {t("extracted_profiles")} ({profiles.length})
          </h3>
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-white border rounded p-4 text-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 truncate">
                    {profile.source_url}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      profile.extraction_confidence >= 0.8
                        ? "bg-green-100 text-green-800"
                        : profile.extraction_confidence >= 0.5
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Math.round(profile.extraction_confidence * 100)}%{" "}
                    {t("confidence")}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-1">
                  {profile.extracted_name && (
                    <>
                      <dt className="text-gray-500">{t("name")}:</dt>
                      <dd>{profile.extracted_name}</dd>
                    </>
                  )}
                  {profile.extracted_phone && (
                    <>
                      <dt className="text-gray-500">{t("phone")}:</dt>
                      <dd>{profile.extracted_phone}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAP Consistency */}
      {napObservations.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">{t("nap_consistency")}</h3>
          <div className="grid gap-2">
            {napObservations.map((nap) => (
              <div
                key={nap.id}
                className="bg-white border rounded p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs text-gray-500">
                    {nap.source_url}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      nap.consistency_score >= 0.9
                        ? "bg-green-100 text-green-800"
                        : nap.consistency_score >= 0.7
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Math.round(nap.consistency_score * 100)}%{" "}
                    {t("consistent")}
                  </span>
                </div>
                {nap.inconsistencies.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600">
                    {nap.inconsistencies.map((inc, i) => (
                      <li key={i}>
                        {inc.field}: &quot;{inc.expected}&quot; vs &quot;
                        {inc.actual}&quot;
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
