import { describe, it, expect } from "vitest";
import { runAllExtractors, getRegisteredExtractors } from "../src/extractor-registry";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: `
    <html>
      <head>
        <title>Test Page</title>
        <link rel="alternate" hreflang="en" href="https://example.com/en" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
      </head>
      <body>
        <h1>Main Heading</h1>
        <h2>Section 1</h2>
        <nav class="breadcrumb">
          <a href="/">Home</a>
          <span>Current</span>
        </nav>
        <form>
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required />
        </form>
        <a href="tel:+1234567890">Call us</a>
        <a href="mailto:info@example.com">Email us</a>
        <a href="/privacy">Privacy Policy</a>
      </body>
    </html>
  `,
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 375,
};

describe("extractor-registry", () => {
  it("registers all extractors", () => {
    const extractors = getRegisteredExtractors();

    expect(extractors.length).toBeGreaterThan(0);
    expect(extractors.map((e) => e.name)).toContain("headingStructure");
    expect(extractors.map((e) => e.name)).toContain("formAnalysis");
    expect(extractors.map((e) => e.name)).toContain("contactLinks");
    expect(extractors.map((e) => e.name)).toContain("policyLinks");
    expect(extractors.map((e) => e.name)).toContain("languageSwitch");
    expect(extractors.map((e) => e.name)).toContain("analyticsDetection");
    expect(extractors.map((e) => e.name)).toContain("viewportMetrics");
    expect(extractors.map((e) => e.name)).toContain("wayfindingCues");
  });

  it("runs all extractors and returns aggregated result", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.headingStructure).toBeDefined();
    expect(result.formAnalysis).toBeDefined();
    expect(result.contactLinks).toBeDefined();
    expect(result.policyLinks).toBeDefined();
    expect(result.languageSwitch).toBeDefined();
    expect(result.analyticsDetection).toBeDefined();
    expect(result.viewportMetrics).toBeDefined();
    expect(result.wayfindingCues).toBeDefined();
  });

  it("extracts heading structure correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.headingStructure?.h1Count).toBe(1);
    expect(result.headingStructure?.hasLogicalOrder).toBe(true);
    expect(result.headingStructure?.primaryHeading).toBe("Main Heading");
  });

  it("extracts form analysis correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.formAnalysis?.totalForms).toBe(1);
    expect(result.formAnalysis?.totalFields).toBe(1);
    expect(result.formAnalysis?.fieldsWithLabels).toBe(1);
    expect(result.formAnalysis?.fieldsRequired).toBe(1);
  });

  it("extracts contact links correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.contactLinks?.hasPhone).toBe(true);
    expect(result.contactLinks?.hasEmail).toBe(true);
    expect(result.contactLinks?.totalLinks).toBe(2);
  });

  it("extracts policy links correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.policyLinks?.hasPrivacy).toBe(true);
    expect(result.policyLinks?.totalLinks).toBe(1);
  });

  it("extracts language switch correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.languageSwitch?.alternates).toHaveLength(1);
    expect(result.languageSwitch?.supportedLanguages).toContain("en");
  });

  it("extracts analytics detection correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.analyticsDetection?.hasAnalytics).toBe(true);
    expect(result.analyticsDetection?.hasGA4).toBe(true);
    expect(result.analyticsDetection?.tagCount).toBe(1);
  });

  it("extracts wayfinding cues correctly", async () => {
    const result = await runAllExtractors(baseEvidence);

    expect(result.wayfindingCues?.hasBreadcrumbs).toBe(true);
    expect(result.wayfindingCues?.hasClearHierarchy).toBe(true);
    expect(result.wayfindingCues?.pageTitle).toBe("Test Page");
  });

  it("handles empty HTML gracefully", async () => {
    const emptyEvidence: EvidencePackage = {
      html: "<html><body></body></html>",
      url: "https://example.com",
      language: "en",
      direction: "ltr",
      viewportWidth: 375,
    };

    const result = await runAllExtractors(emptyEvidence);

    expect(result.headingStructure).toBeDefined();
    expect(result.formAnalysis).toBeDefined();
    expect(result.contactLinks).toBeDefined();
    expect(result.policyLinks).toBeDefined();
    expect(result.languageSwitch).toBeDefined();
    expect(result.analyticsDetection).toBeDefined();
    expect(result.viewportMetrics).toBeDefined();
    expect(result.wayfindingCues).toBeDefined();
  });
});
