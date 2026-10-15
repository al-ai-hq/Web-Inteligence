import { describe, it, expect } from "vitest";
import { extractAnalyticsDetection } from "../src/analytics-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("analytics-extractor", () => {
  it("detects GA4 tag via gtag.js", () => {
    const html = `
      <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ABC123XYZ');
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(true);
    expect(result.hasGA4).toBe(true);
    expect(result.tagCount).toBe(1);
    expect(result.tags[0]).toMatchObject({
      type: "ga4",
      id: "G-ABC123XYZ",
      detected: true,
    });
  });

  it("detects Universal Analytics tag", () => {
    const html = `
      <html>
        <head>
          <script>
            (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
            })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
            ga('create', 'UA-12345678-1', 'auto');
            ga('send', 'pageview');
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(true);
    expect(result.hasGA4).toBe(false);
    expect(result.tagCount).toBe(1);
    expect(result.tags[0]).toMatchObject({
      type: "ua",
      id: "UA-12345678-1",
      detected: true,
    });
  });

  it("detects gtag.js without specific ID", () => {
    const html = `
      <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js"></script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(true);
    expect(result.tagCount).toBe(1);
    expect(result.tags[0]).toMatchObject({
      type: "gtag",
      detected: true,
    });
  });

  it("detects analytics.js script", () => {
    const html = `
      <html>
        <head>
          <script src="https://www.google-analytics.com/analytics.js"></script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(true);
    expect(result.tagCount).toBe(1);
    expect(result.tags[0]).toMatchObject({
      type: "analytics.js",
      detected: true,
    });
  });

  it("detects multiple analytics tags", () => {
    const html = `
      <html>
        <head>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
          <script>
            ga('create', 'UA-98765432-1', 'auto');
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(true);
    expect(result.hasGA4).toBe(true);
    expect(result.tagCount).toBe(2);
  });

  it("handles pages without analytics", () => {
    const html = `
      <html>
        <head>
          <script src="https://example.com/script.js"></script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasAnalytics).toBe(false);
    expect(result.hasGA4).toBe(false);
    expect(result.tagCount).toBe(0);
    expect(result.tags).toHaveLength(0);
  });

  it("handles empty HTML", () => {
    const result = extractAnalyticsDetection({
      ...baseEvidence,
      html: "<html><body></body></html>",
    });

    expect(result.hasAnalytics).toBe(false);
    expect(result.hasGA4).toBe(false);
    expect(result.tagCount).toBe(0);
  });

  it("detects GA4 ID from inline config", () => {
    const html = `
      <html>
        <head>
          <script>
            gtag('config', 'G-XYZ789ABC');
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = extractAnalyticsDetection({ ...baseEvidence, html });

    expect(result.hasGA4).toBe(true);
    expect(result.tags[0]).toMatchObject({
      type: "ga4",
      id: "G-XYZ789ABC",
      detected: true,
    });
  });
});
