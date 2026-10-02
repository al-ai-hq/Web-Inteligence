import { describe, expect, it } from "vitest";
import {
  ELIGIBILITY_COOKIE_NAME,
  generateAuditSecret,
  hashAuditSecret,
  incrementEligibilityCookie,
  signEligibilityCookie,
  verifyEligibilityCookie,
} from "../src/secrets.js";

describe("audit secret", () => {
  it("generates 43-char base64url secrets", () => {
    const secret = generateAuditSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes deterministically with sha256: prefix", () => {
    expect(hashAuditSecret("abc")).toBe(hashAuditSecret("abc"));
    expect(hashAuditSecret("abc")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("eligibility cookie", () => {
  const counts = { rich_count: 1, reduced_count: 0, preview_count: 2 };

  it("round-trips sign -> verify", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    expect(verifyEligibilityCookie(signed, "test-secret")).toEqual(counts);
  });

  it("rejects a tampered body", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    const [body, mac] = signed.split(".");
    const forged = Buffer.from(
      JSON.stringify({ rich_count: 99, reduced_count: 0, preview_count: 0 }),
    ).toString("base64url");
    expect(verifyEligibilityCookie(`${forged}.${mac}`, "test-secret")).toBeNull();
  });

  it("rejects a wrong secret", () => {
    const signed = signEligibilityCookie(counts, "test-secret");
    expect(verifyEligibilityCookie(signed, "other-secret")).toBeNull();
  });

  it("rejects garbage, empty, and multi-dot values", () => {
    expect(verifyEligibilityCookie("", "s")).toBeNull();
    expect(verifyEligibilityCookie("nonsense", "s")).toBeNull();
    expect(verifyEligibilityCookie("a.b.c", "s")).toBeNull();
  });

  it("rejects a valid MAC over non-integer counts", () => {
    const body = Buffer.from(
      JSON.stringify({ rich_count: -1, reduced_count: 0, preview_count: 0 }),
    ).toString("base64url");
    const signed = signEligibilityCookie(counts, "s").split(".")[1];
    const forged = `${body}.${signed}`;
    expect(verifyEligibilityCookie(forged, "s")).toBeNull();
  });

  it("increments only the consumed tier", () => {
    const next = JSON.parse(
      Buffer.from(
        incrementEligibilityCookie(counts, "reduced", "s").split(".")[0] ?? "",
        "base64url",
      ).toString("utf8"),
    ) as { rich_count: number; reduced_count: number; preview_count: number };
    expect(next).toEqual({ rich_count: 1, reduced_count: 1, preview_count: 2 });
  });

  it("uses a stable cookie name", () => {
    expect(ELIGIBILITY_COOKIE_NAME).toBe("wpi_eligibility");
  });
});
