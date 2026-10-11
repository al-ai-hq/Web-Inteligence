import type { NapConsistencyResult } from "./engine.js";

export interface DetectedConflict {
  fact_sheet_id: string;
  fact_key: string;
  confirmed_value: unknown;
  conflicting_value: unknown;
  source_type: "nap_inconsistency";
  source_id: string;
  severity: "low" | "medium" | "high" | "critical";
}

export function detectConflicts(
  factSheetId: string,
  results: NapConsistencyResult[],
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  for (const result of results) {
    for (const inconsistency of result.inconsistencies) {
      conflicts.push({
        fact_sheet_id: factSheetId,
        fact_key: inconsistency.field,
        confirmed_value: { value: inconsistency.expected },
        conflicting_value: { value: inconsistency.actual },
        source_type: "nap_inconsistency",
        source_id: result.source_url,
        severity: classifySeverity(inconsistency.field),
      });
    }
  }

  return conflicts;
}

function classifySeverity(field: string): "low" | "medium" | "high" | "critical" {
  if (field === "phone") return "high";
  if (field === "name") return "medium";
  if (field.startsWith("address.")) return "low";
  return "low";
}
