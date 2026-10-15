import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ELIGIBILITY_COOKIE_NAME = "wpi_eligibility";

export function generateAuditSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuditSecret(secret: string): string {
  return `sha256:${createHash("sha256").update(secret, "utf8").digest("hex")}`;
}

export interface EligibilityCounts {
  rich_count: number;
  reduced_count: number;
  preview_count: number;
}

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export function signEligibilityCookie(counts: EligibilityCounts, secret: string): string {
  const body = Buffer.from(JSON.stringify(counts), "utf8").toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verifyEligibilityCookie(value: string, secret: string): EligibilityCounts | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const expected = mac(body, secret);
  const given = value.slice(dot + 1);
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(given, "utf8");
  if (expectedBuf.length !== givenBuf.length || !timingSafeEqual(expectedBuf, givenBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      rich_count?: unknown;
      reduced_count?: unknown;
      preview_count?: unknown;
    };
    const isCount = (v: unknown): v is number =>
      typeof v === "number" && Number.isInteger(v) && v >= 0;
    if (
      !isCount(parsed.rich_count) ||
      !isCount(parsed.reduced_count) ||
      !isCount(parsed.preview_count)
    ) {
      return null;
    }
    return {
      rich_count: parsed.rich_count,
      reduced_count: parsed.reduced_count,
      preview_count: parsed.preview_count,
    };
  } catch {
    return null;
  }
}

export function incrementEligibilityCookie(
  counts: EligibilityCounts,
  tier: "rich" | "reduced" | "preview",
  secret: string,
): string {
  const next: EligibilityCounts =
    tier === "rich"
      ? { ...counts, rich_count: counts.rich_count + 1 }
      : tier === "reduced"
        ? { ...counts, reduced_count: counts.reduced_count + 1 }
        : { ...counts, preview_count: counts.preview_count + 1 };
  return signEligibilityCookie(next, secret);
}
