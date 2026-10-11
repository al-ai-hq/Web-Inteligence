export interface FactSheetForNap {
  business_name: string;
  phone: string | null;
  address: {
    street: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
}

export interface ObservationForNap {
  source_url: string;
  extracted_name: string | null;
  extracted_phone: string | null;
  extracted_address: Record<string, string> | null;
}

export interface Inconsistency {
  field: string;
  expected: string;
  actual: string;
}

export interface NapConsistencyResult {
  source_url: string;
  consistency_score: number;
  inconsistencies: Inconsistency[];
}

export function computeNapConsistency(
  factSheet: FactSheetForNap,
  observation: ObservationForNap,
): NapConsistencyResult {
  const inconsistencies: Inconsistency[] = [];
  let totalFields = 0;
  let matchedFields = 0;

  if (observation.extracted_name !== null && factSheet.business_name) {
    totalFields++;
    if (normalizeText(observation.extracted_name) === normalizeText(factSheet.business_name)) {
      matchedFields++;
    } else {
      inconsistencies.push({
        field: "name",
        expected: factSheet.business_name,
        actual: observation.extracted_name,
      });
    }
  }

  if (observation.extracted_phone !== null && factSheet.phone) {
    totalFields++;
    if (normalizePhone(observation.extracted_phone) === normalizePhone(factSheet.phone)) {
      matchedFields++;
    } else {
      inconsistencies.push({
        field: "phone",
        expected: factSheet.phone,
        actual: observation.extracted_phone,
      });
    }
  }

  if (observation.extracted_address !== null && factSheet.address) {
    const addressFields = ["street", "city", "region", "postal_code", "country"] as const;
    for (const field of addressFields) {
      const factValue = factSheet.address[field];
      const obsValue = observation.extracted_address[field] ?? null;
      if (obsValue !== null && factValue !== null) {
        totalFields++;
        if (normalizeText(obsValue) === normalizeText(factValue)) {
          matchedFields++;
        } else {
          inconsistencies.push({
            field: `address.${field}`,
            expected: factValue,
            actual: obsValue,
          });
        }
      }
    }
  }

  const consistency_score = totalFields === 0 ? 1.0 : matchedFields / totalFields;

  return {
    source_url: observation.source_url,
    consistency_score,
    inconsistencies,
  };
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}
