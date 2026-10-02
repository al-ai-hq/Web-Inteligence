import { describe, expect, it } from "vitest";
import { describeAuditView } from "../services/audit-view";

describe("describeAuditView", () => {
  it("maps READY_COMPLETE and READY_PARTIAL to ready", () => {
    expect(describeAuditView("READY_COMPLETE", null)).toEqual({ kind: "ready" });
    expect(describeAuditView("READY_PARTIAL", null)).toEqual({ kind: "ready" });
  });

  it("maps FAILED to failed with the stored reason", () => {
    expect(describeAuditView("FAILED", "failure.url_invalid")).toEqual({
      kind: "failed",
      reasonKey: "failure.url_invalid",
    });
  });

  it("falls back to a generic failure reason", () => {
    expect(describeAuditView("FAILED", null)).toEqual({
      kind: "failed",
      reasonKey: "failure.pipeline_error",
    });
  });

  it("maps every other status to running", () => {
    expect(describeAuditView("QUEUED", null)).toEqual({ kind: "running" });
    expect(describeAuditView("CRAWLING", null)).toEqual({ kind: "running" });
    expect(describeAuditView("COMPOSING", null)).toEqual({ kind: "running" });
  });
});
