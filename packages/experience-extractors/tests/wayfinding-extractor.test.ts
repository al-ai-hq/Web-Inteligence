import { describe, it, expect } from "vitest";
import { extractWayfindingCues } from "../src/wayfinding-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("wayfinding-extractor", () => {
  it("detects breadcrumbs by class", () => {
    const html = `
      <html>
        <head>
          <title>Product Page</title>
        </head>
        <body>
          <nav class="breadcrumb">
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <span>Current Product</span>
          </nav>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasBreadcrumbs).toBe(true);
    expect(result.breadcrumbElements.length).toBeGreaterThan(0);
    expect(result.pageTitle).toBe("Product Page");
  });

  it("detects breadcrumbs by aria-label", () => {
    const html = `
      <html>
        <body>
          <nav aria-label="breadcrumb">
            <a href="/">Home</a>
            <span>Current</span>
          </nav>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasBreadcrumbs).toBe(true);
  });

  it("detects breadcrumbs by ID", () => {
    const html = `
      <html>
        <body>
          <ol id="breadcrumbs">
            <li><a href="/">Home</a></li>
            <li>Current</li>
          </ol>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasBreadcrumbs).toBe(true);
  });

  it("detects active state in navigation", () => {
    const html = `
      <html>
        <body>
          <nav>
            <a href="/" class="active">Home</a>
            <a href="/about">About</a>
          </nav>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasActiveState).toBe(true);
  });

  it("detects current state in navigation", () => {
    const html = `
      <html>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/about" class="current">About</a>
          </nav>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasActiveState).toBe(true);
  });

  it("detects clear heading hierarchy", () => {
    const html = `
      <html>
        <body>
          <h1>Main Title</h1>
          <h2>Section 1</h2>
          <h3>Subsection 1.1</h3>
          <h2>Section 2</h2>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasClearHierarchy).toBe(true);
  });

  it("detects unclear heading hierarchy", () => {
    const html = `
      <html>
        <body>
          <h1>Main Title</h1>
          <h3>Skipped H2</h3>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasClearHierarchy).toBe(false);
  });

  it("handles pages without wayfinding cues", () => {
    const html = `
      <html>
        <body>
          <p>Just some content</p>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasBreadcrumbs).toBe(false);
    expect(result.hasActiveState).toBe(false);
    expect(result.hasClearHierarchy).toBe(false);
    expect(result.pageTitle).toBeUndefined();
  });

  it("handles empty HTML", () => {
    const result = extractWayfindingCues({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.hasBreadcrumbs).toBe(false);
    expect(result.hasActiveState).toBe(false);
    expect(result.hasClearHierarchy).toBe(false);
    expect(result.breadcrumbElements).toHaveLength(0);
  });

  it("extracts page title from head", () => {
    const html = `
      <html>
        <head>
          <title>About Us - Company Name</title>
        </head>
        <body></body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.pageTitle).toBe("About Us - Company Name");
  });

  it("detects active state by aria-current", () => {
    const html = `
      <html>
        <body>
          <nav>
            <a href="/" aria-current="page">Home</a>
            <a href="/about">About</a>
          </nav>
        </body>
      </html>
    `;

    const result = extractWayfindingCues({ ...baseEvidence, html });

    expect(result.hasActiveState).toBe(true);
  });
});
