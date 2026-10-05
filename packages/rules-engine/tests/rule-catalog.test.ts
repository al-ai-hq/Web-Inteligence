import { describe, it, expect } from "vitest";
import { RuleCatalog } from "../src/rule-catalog.js";
import type { LoadedRule } from "../src/types.js";

describe("RuleCatalog", () => {
  const mockRules: LoadedRule[] = [
    {
      id: "CRW-001",
      category: "crawlability",
      title: "Homepage retrievable",
      importance_weight: 5,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      applicability: "always",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
    {
      id: "GSC-001",
      category: "crawlability",
      title: "GSC indexing",
      importance_weight: 3,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: true,
      applicability: "connected",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
    {
      id: "SEO-011",
      category: "on_page",
      title: "Keyword in title",
      importance_weight: 2,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      requires_data: "keyword_data",
      applicability: "keyword",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
  ];

  it("excludes connected-tier-only rules for preview tier", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("preview", "en");
    expect(applicable.find((r) => r.id === "GSC-001")).toBeUndefined();
  });

  it("includes connected-tier-only rules for rich tier", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("rich", "en");
    expect(applicable.find((r) => r.id === "GSC-001")).toBeDefined();
  });

  it("excludes rules requiring unavailable data sources", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("rich", "en");
    expect(applicable.find((r) => r.id === "SEO-011")).toBeUndefined();
  });
});
