import { describe, it, expect } from "vitest";
import { extractViewportMetrics } from "../src/viewport-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 375,
};

describe("viewport-extractor", () => {
  it("detects elements with fixed width exceeding viewport", () => {
    const html = `
      <html>
        <body>
          <div style="width: 500px">Wide content</div>
          <p>Normal content</p>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.viewportWidth).toBe(375);
    expect(result.hasHorizontalScroll).toBe(true);
    expect(result.overflowElements.length).toBeGreaterThan(0);
  });

  it("detects images without max-width", () => {
    const html = `
      <html>
        <body>
          <img src="large.jpg" width="800" />
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.hasHorizontalScroll).toBe(true);
    expect(result.overflowElements.length).toBeGreaterThan(0);
  });

  it("handles responsive images with max-width", () => {
    const html = `
      <html>
        <body>
          <img src="large.jpg" style="max-width: 100%; height: auto;" />
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.overflowElements.filter((e) => e.includes("img"))).toHaveLength(0);
  });

  it("detects tables that may cause overflow", () => {
    const html = `
      <html>
        <body>
          <table>
            <tr>
              <td>Column 1</td>
              <td>Column 2</td>
              <td>Column 3</td>
              <td>Column 4</td>
              <td>Column 5</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.overflowElements.some((e) => e.includes("table"))).toBe(true);
  });

  it("handles pages without overflow issues", () => {
    const html = `
      <html>
        <body>
          <div style="max-width: 100%">Content</div>
          <p>Normal text</p>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.hasHorizontalScroll).toBe(false);
    expect(result.overflowElements).toHaveLength(0);
  });

  it("handles empty HTML", () => {
    const result = extractViewportMetrics({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.viewportWidth).toBe(375);
    expect(result.hasHorizontalScroll).toBe(false);
    expect(result.overflowElements).toHaveLength(0);
  });

  it("detects elements with min-width exceeding viewport", () => {
    const html = `
      <html>
        <body>
          <div style="min-width: 400px">Wide content</div>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.hasHorizontalScroll).toBe(true);
  });

  it("reports content width as viewport when no overflow", () => {
    const html = `
      <html>
        <body>
          <div>Normal content</div>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.contentWidth).toBeLessThanOrEqual(result.viewportWidth);
  });

  it("detects pre elements that may overflow", () => {
    const html = `
      <html>
        <body>
          <pre>Very long line of code that might cause horizontal scrolling in the page</pre>
        </body>
      </html>
    `;

    const result = extractViewportMetrics({ ...baseEvidence, html });

    expect(result.overflowElements.some((e) => e.includes("pre"))).toBe(true);
  });
});
