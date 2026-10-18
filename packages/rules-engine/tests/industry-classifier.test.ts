import { describe, expect, test } from "vitest";
import { classifyIndustry } from "../src/industry-classifier.js";
import { loadRecommendationConfig } from "../src/recommendation-config.js";

describe("classifyIndustry", () => {
  test("business_type saas wins over other signals", () => {
    const result = classifyIndustry({
      business_type: "saas",
      schema_types: ["Product"],
      url_paths: ["/shop/"],
    });
    expect(result.industry).toBe("saas");
    expect(result.basis).toContain("business_type");
  });

  test("normalizes the free-text values the audit form actually produces", () => {
    // business_type is user-typed free text (audit-context.ts zod: string 1-200).
    expect(classifyIndustry({ business_type: "e-commerce" }).industry).toBe("ecommerce");
    expect(classifyIndustry({ business_type: "SaaS" }).industry).toBe("saas");
    expect(classifyIndustry({ business_type: "  Professional Services  " }).industry).toBe(
      "professional_services",
    );
  });

  test("schema Product maps to ecommerce when business_type absent", () => {
    expect(classifyIndustry({ schema_types: ["Product"] }).industry).toBe("ecommerce");
  });

  test("schema LocalBusiness maps to local", () => {
    expect(classifyIndustry({ schema_types: ["LocalBusiness"] }).industry).toBe("local");
  });

  test("schema BlogPosting maps to publisher", () => {
    expect(classifyIndustry({ schema_types: ["BlogPosting"] }).industry).toBe("publisher");
  });

  test("service and app schema types map to their industries", () => {
    expect(classifyIndustry({ schema_types: ["LegalService"] }).industry).toBe(
      "professional_services",
    );
    expect(classifyIndustry({ schema_types: ["SoftwareApplication"] }).industry).toBe("saas");
  });

  test("unmapped business_type falls through to the next signal", () => {
    const result = classifyIndustry({ business_type: "vertical farming", schema_types: ["Product"] });
    expect(result.industry).toBe("ecommerce");
    expect(result.basis).toContain("schema");
  });

  test("url paths are the last signal before the generic fallback", () => {
    expect(classifyIndustry({ url_paths: ["", "/products/widget/"] }).industry).toBe("ecommerce");
    expect(classifyIndustry({ url_paths: ["/blog/post-1"] }).industry).toBe("publisher");
    expect(classifyIndustry({ url_paths: ["/services/tax"] }).industry).toBe(
      "professional_services",
    );
  });

  test("falls back to generic", () => {
    const result = classifyIndustry({});
    expect(result.industry).toBe("generic");
    expect(result.basis).toBe("default");
  });

  test("every industry the classifier can return has a playbook", () => {
    const playbookIds = loadRecommendationConfig().playbooks.map((p) => p.playbook_id);
    const signals = [
      { business_type: "saas" },
      { business_type: "retail" },
      { business_type: "clinic" },
      { business_type: "news" },
      { business_type: "agency" },
      { schema_types: ["LocalBusiness"] },
      {},
    ];
    for (const signal of signals) {
      expect(playbookIds).toContain(classifyIndustry(signal).industry);
    }
  });
});
