import { describe, expect, it } from "vitest";
import enMessages from "../messages/en.json";
import arMessages from "../messages/ar.json";

const REQUIRED_KEYS = [
  "title",
  "summary",
  "verification_title",
  "verification_verified",
  "verification_inferred",
  "verification_not_verified",
  "confidence_title",
  "confidence_high",
  "confidence_medium",
  "confidence_low",
  "scoring_title",
  "scoring_body",
  "evidence_title",
  "evidence_body",
  "sample_note",
  "full_methodology",
] as const;

describe("methodology disclosure i18n", () => {
  it("has all required keys in en.json", () => {
    const md = enMessages.methodology_disclosure;
    expect(md).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect((md as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it("has all required keys in ar.json", () => {
    const md = arMessages.methodology_disclosure;
    expect(md).toBeDefined();
    for (const key of REQUIRED_KEYS) {
      expect((md as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it("has identical key structures between en and ar", () => {
    const enKeys = Object.keys(enMessages.methodology_disclosure).sort();
    const arKeys = Object.keys(arMessages.methodology_disclosure).sort();
    expect(enKeys).toEqual(arKeys);
  });

  it("has evidence_items key in report namespace for both locales", () => {
    expect(enMessages.report.evidence_items).toBeTruthy();
    expect(arMessages.report.evidence_items).toBeTruthy();
  });
});
