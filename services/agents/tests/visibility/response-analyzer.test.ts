import { describe, it, expect } from "vitest";
import { analyzeResponse } from "../../src/visibility/response-analyzer.js";
import type { VisibilityIntake } from "../../src/visibility/types.js";

const intake: VisibilityIntake = {
  brand_name: "Acme",
  offering_description: "cloud hosting",
  target_audience: "startups",
  market: "SA",
  category: "hosting",
  city: "Riyadh",
  use_case: null,
  requirement: null,
  brand_domain: "acme.com",
  competitor_domains: ["rival.com", "competitor.io"],
  brand_aliases: ["Acme Corp", "Acme Hosting"],
  brand_facts: [
    { claim: "Founded in 2020", category: "other" },
    { claim: "Based in Riyadh", category: "location" },
  ],
};

describe("analyzeResponse", () => {
  it("detects brand mention by name", () => {
    const result = analyzeResponse("Acme is a great cloud hosting provider.", intake, "discovery");
    expect(result.brand_mentioned).toBe(true);
    expect(result.mention_spans.length).toBeGreaterThan(0);
    expect(result.mention_spans[0]!.text).toBe("Acme");
  });

  it("detects brand mention by alias", () => {
    const result = analyzeResponse("I recommend Acme Corp for hosting.", intake, "discovery");
    expect(result.brand_mentioned).toBe(true);
  });

  it("returns brand_mentioned false when brand not in response", () => {
    const result = analyzeResponse("The best providers are Rival and Others.", intake, "discovery");
    expect(result.brand_mentioned).toBe(false);
    expect(result.competitors_mentioned).toContain("rival.com");
  });

  it("detects competitor mentions", () => {
    const result = analyzeResponse(
      "Check out rival.com and competitor.io for hosting.",
      intake,
      "comparison",
    );
    expect(result.competitors_mentioned.length).toBe(2);
  });

  it("classifies citations by domain ownership", () => {
    const result = analyzeResponse(
      "Visit https://acme.com for details, or see https://rival.com/pricing and https://review-site.com/acme-review",
      intake,
      "citation",
    );
    expect(result.citations).toHaveLength(3);
    expect(result.citations[0]!.owner_class).toBe("owned");
    expect(result.citations[0]!.position).toBe(1);
    expect(result.citations[1]!.owner_class).toBe("competitor");
    expect(result.citations[1]!.position).toBe(2);
    expect(result.citations[2]!.owner_class).toBe("third_party");
    expect(result.citations[2]!.position).toBe(3);
  });

  it("sets brand_url_cited when owned domain appears", () => {
    const result = analyzeResponse("See https://acme.com for more.", intake, "discovery");
    expect(result.brand_url_cited).toBe(true);
  });

  it("returns empty citations when no URLs present", () => {
    const result = analyzeResponse("Acme is a hosting company.", intake, "discovery");
    expect(result.citations).toHaveLength(0);
    expect(result.brand_url_cited).toBe(false);
  });

  it("detects accuracy issues against brand facts", () => {
    const result = analyzeResponse(
      "Acme was founded in 2018 and is based in Dubai.",
      intake,
      "brand_facts",
    );
    expect(result.accuracy_issues.length).toBeGreaterThan(0);
  });

  it("returns no accuracy issues for non-brand-facts families", () => {
    const result = analyzeResponse("Acme was founded in 2018.", intake, "discovery");
    expect(result.accuracy_issues).toHaveLength(0);
  });
});
