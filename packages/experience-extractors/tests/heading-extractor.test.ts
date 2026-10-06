import { describe, it, expect } from "vitest";
import { extractHeadingStructure } from "../src/heading-extractor.js";
import type { EvidencePackage } from "../src/types.js";

describe("heading-extractor", () => {
  const baseEvidence: EvidencePackage = {
    html: "",
    url: "https://example.com",
    language: "en",
    direction: "ltr",
    viewportWidth: 1920,
  };

  it("extracts single H1", () => {
    const evidence = {
      ...baseEvidence,
      html: "<html><body><h1>Main Title</h1><p>Content</p></body></html>",
    };

    const result = extractHeadingStructure(evidence);

    expect(result.h1Count).toBe(1);
    expect(result.primaryHeading).toBe("Main Title");
    expect(result.headings).toHaveLength(1);
    expect(result.hasLogicalOrder).toBe(true);
  });

  it("detects multiple H1s", () => {
    const evidence = {
      ...baseEvidence,
      html: "<html><body><h1>First</h1><h1>Second</h1></body></html>",
    };

    const result = extractHeadingStructure(evidence);

    expect(result.h1Count).toBe(2);
    expect(result.hasLogicalOrder).toBe(true);
  });

  it("validates logical heading order", () => {
    const evidence = {
      ...baseEvidence,
      html: `
        <html><body>
          <h1>Title</h1>
          <h2>Section</h2>
          <h3>Subsection</h3>
          <h2>Another Section</h2>
        </body></html>
      `,
    };

    const result = extractHeadingStructure(evidence);

    expect(result.hasLogicalOrder).toBe(true);
    expect(result.headings).toHaveLength(4);
  });

  it("detects illogical heading order", () => {
    const evidence = {
      ...baseEvidence,
      html: `
        <html><body>
          <h1>Title</h1>
          <h3>Skipped H2</h3>
        </body></html>
      `,
    };

    const result = extractHeadingStructure(evidence);

    expect(result.hasLogicalOrder).toBe(false);
  });

  it("extracts heading IDs", () => {
    const evidence = {
      ...baseEvidence,
      html: '<html><body><h1 id="main">Title</h1></body></html>',
    };

    const result = extractHeadingStructure(evidence);

    expect(result.headings[0].id).toBe("main");
  });

  it("handles empty HTML", () => {
    const evidence = {
      ...baseEvidence,
      html: "<html><body></body></html>",
    };

    const result = extractHeadingStructure(evidence);

    expect(result.h1Count).toBe(0);
    expect(result.headings).toHaveLength(0);
    expect(result.hasLogicalOrder).toBe(true);
  });
});
