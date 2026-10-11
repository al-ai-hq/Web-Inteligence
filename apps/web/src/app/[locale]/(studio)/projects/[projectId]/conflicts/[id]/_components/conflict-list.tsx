"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityConflict } from "@wpi/footprint-store";
import { useTranslations } from "next-intl";

interface ConflictListProps {
  conflicts: EntityConflict[];
  factSheetId: string;
  locale: string;
  projectId: string;
}

export function ConflictList({ conflicts, factSheetId, locale, projectId }: ConflictListProps) {
  const t = useTranslations("conflicts");
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedBy, setResolvedBy] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const handleResolve = async (conflictId: string, confirmedValue: unknown) => {
    if (!resolvedBy.trim()) return;

    const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed_value: confirmedValue,
        resolved_by: resolvedBy,
        resolution_note: resolutionNote,
      }),
    });

    if (response.ok) {
      setResolvingId(null);
      setResolvedBy("");
      setResolutionNote("");
      router.refresh();
    }
  };

  const handleDismiss = async (conflictId: string) => {
    if (!resolvedBy.trim()) return;

    const response = await fetch(`/api/conflicts/${conflictId}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolved_by: resolvedBy,
        resolution_note: resolutionNote,
      }),
    });

    if (response.ok) {
      setResolvingId(null);
      setResolvedBy("");
      setResolutionNote("");
      router.refresh();
    }
  };

  const openConflicts = conflicts.filter((c) => c.status === "open" || c.status === "investigating");
  const resolvedConflicts = conflicts.filter((c) => c.status === "resolved" || c.status === "dismissed");

  return (
    <div className="space-y-6">
      {/* Resolver identity */}
      <div className="bg-gray-50 border rounded p-4">
        <label htmlFor="resolved_by" className="block text-sm font-medium mb-1">
          {t("your_name")} *
        </label>
        <input
          id="resolved_by"
          type="text"
          value={resolvedBy}
          onChange={(e) => setResolvedBy(e.target.value)}
          placeholder={t("enter_your_name")}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Open conflicts */}
      {openConflicts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("open_conflicts")} ({openConflicts.length})</h2>
          <div className="space-y-3">
            {openConflicts.map((conflict) => (
              <div key={conflict.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{conflict.fact_key}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      conflict.severity === "critical" ? "bg-red-100 text-red-800" :
                      conflict.severity === "high" ? "bg-orange-100 text-orange-800" :
                      conflict.severity === "medium" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {conflict.severity}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{conflict.source_type}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  {conflict.confirmed_value != null && (
                    <div>
                      <span className="text-gray-500">{t("confirmed")}:</span>
                      <pre className="bg-green-50 p-2 rounded text-xs mt-1">
                        {JSON.stringify(conflict.confirmed_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">{t("conflicting")}:</span>
                    <pre className="bg-red-50 p-2 rounded text-xs mt-1">
                      {JSON.stringify(conflict.conflicting_value, null, 2)}
                    </pre>
                  </div>
                </div>

                {resolvingId === conflict.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder={t("resolution_note_placeholder")}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolve(conflict.id, conflict.conflicting_value)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        {t("accept_conflicting")}
                      </button>
                      <button
                        onClick={() => handleResolve(conflict.id, conflict.confirmed_value)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        {t("keep_confirmed")}
                      </button>
                      <button
                        onClick={() => handleDismiss(conflict.id)}
                        className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                      >
                        {t("dismiss")}
                      </button>
                      <button
                        onClick={() => setResolvingId(null)}
                        className="text-gray-500 px-3 py-1 text-sm"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingId(conflict.id)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    {t("resolve")} &rarr;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved conflicts */}
      {resolvedConflicts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-500">{t("resolved")} ({resolvedConflicts.length})</h2>
          <div className="space-y-2">
            {resolvedConflicts.map((conflict) => (
              <div key={conflict.id} className="border rounded p-3 bg-gray-50 text-sm opacity-75">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{conflict.fact_key}</span>
                  <span className="text-xs text-gray-500 capitalize">{conflict.status}</span>
                </div>
                {conflict.resolution_note && (
                  <p className="text-xs text-gray-500 mt-1">{conflict.resolution_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && (
        <p className="text-gray-500 text-center py-8">{t("no_conflicts")}</p>
      )}
    </div>
  );
}
