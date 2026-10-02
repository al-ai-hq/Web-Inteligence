import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/paths.js";
import { buildReportModel, validateReportModel } from "../src/report-model.js";

const SCHEMAS = join(REPO_ROOT, "schemas");

function params() {
  return {
    auditId: "1f0a9c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    locale: "en" as const,
    // Must satisfy the schema's content_hash pattern (^sha256:[0-9a-f]{64}$)
    // required for anonymous reports; the brief's "sha256:abc" placeholder
    // fails real-schema validation.
    secretHash: "sha256:" + "a".repeat(64),
    expiresAt: new Date("2030-01-01T00:00:00.000Z").toISOString(),
    summaryBullets: ["report.summary.technical"],
    findingIds: ["a1a1a1a1-1111-4111-8111-111111111111"],
    limitationsKeys: ["limitation.score_engine_deferred"],
    pagesChecked: 3,
    sampled: true,
    findings: [],
  };
}

describe("buildReportModel", () => {
  it("emits a report that validates against the real schema", () => {
    const report = buildReportModel(params());
    expect(() => validateReportModel(report, SCHEMAS)).not.toThrow();
  });

  it("uses real uuids for report_id/audit_id and a 32-char link_id", () => {
    const report = buildReportModel(params());
    expect(report.report_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(report.audit_id).toBe("1f0a9c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b");
    expect(report.access.link_id).toBe("1f0a9c2e3b4d4e5f8a9b0c1d2e3f4a5b");
    expect(report.access.noindex).toBe(true);
    expect(report.access.public_gallery).toBe(false);
  });

  it("carries the anonymous M4 projection set and 7-day retention", () => {
    const report = buildReportModel(params());
    expect(report.access_class).toBe("anonymous");
    expect(report.allowed_projections).toEqual(["web_interactive"]);
    expect(report.languages).toEqual(["en"]);
    expect(report.retention_days).toBe(7);
    expect(report.content.sample_disclosure).toEqual({ pages_checked: 3, sampled: true });
    expect(report.lineage_coverage.ratio).toBe(1);
  });
});

describe("validateReportModel", () => {
  it("throws with Ajv detail for a tampered report", () => {
    const report = buildReportModel(params()) as Record<string, unknown>;
    report["retention_days"] = 30;
    expect(() => validateReportModel(report, SCHEMAS)).toThrow(/retention_days|must be/);
  });
});
