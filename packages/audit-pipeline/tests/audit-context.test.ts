import { describe, expect, it } from "vitest";
import { auditContextSchema, createAuditRequestSchema } from "../src/audit-context.js";

const validContext = {
  organization: "Example Ltd",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Facility managers",
};

describe("auditContextSchema", () => {
  it("accepts the six required questions from 02-DETAILED-SPECIFICATION §Context", () => {
    expect(auditContextSchema.parse(validContext)).toEqual(validContext);
  });

  it("accepts optional competitors and up to 10 target keywords", () => {
    const parsed = auditContextSchema.parse({
      ...validContext,
      competitors: "competitor-a.com",
      target_keywords: ["office chairs", "standing desks"],
    });
    expect(parsed.target_keywords).toHaveLength(2);
  });

  it("rejects more than 10 target keywords", () => {
    const keywords = Array.from({ length: 11 }, (_, i) => `keyword-${i}`);
    expect(
      auditContextSchema.safeParse({ ...validContext, target_keywords: keywords }).success,
    ).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    expect(auditContextSchema.safeParse({ ...validContext, bonus: "x" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { organization: _omitted, ...incomplete } = validContext;
    expect(auditContextSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe("createAuditRequestSchema", () => {
  it("accepts url, locale, context", () => {
    const parsed = createAuditRequestSchema.parse({
      url: "https://example.com",
      locale: "ar",
      context: validContext,
    });
    expect(parsed.locale).toBe("ar");
  });

  it("rejects unknown locales and unknown top-level keys", () => {
    expect(
      createAuditRequestSchema.safeParse({
        url: "https://example.com",
        locale: "fr",
        context: validContext,
      }).success,
    ).toBe(false);
    expect(
      createAuditRequestSchema.safeParse({
        url: "https://example.com",
        locale: "en",
        context: validContext,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});
