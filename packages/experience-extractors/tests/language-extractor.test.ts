import { describe, it, expect } from "vitest";
import { extractLanguageSwitch } from "../src/language-extractor";
import type { EvidencePackage } from "../src/types";

const baseEvidence: EvidencePackage = {
  html: "",
  url: "https://example.com",
  language: "en",
  direction: "ltr",
  viewportWidth: 1280,
};

describe("language-extractor", () => {
  it("extracts hreflang alternates", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" hreflang="en" href="https://example.com/en" />
          <link rel="alternate" hreflang="ar" href="https://example.com/ar" />
          <link rel="alternate" hreflang="fr" href="https://example.com/fr" />
        </head>
        <body></body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.alternates).toHaveLength(3);
    expect(result.supportedLanguages).toEqual(["en", "ar", "fr"]);
    expect(result.alternates[0]).toMatchObject({
      hreflang: "en",
      href: "https://example.com/en",
    });
    expect(result.alternates[1]).toMatchObject({
      hreflang: "ar",
      href: "https://example.com/ar",
    });
  });

  it("detects visible language switcher by class", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" hreflang="en" href="https://example.com/en" />
          <link rel="alternate" hreflang="ar" href="https://example.com/ar" />
        </head>
        <body>
          <div class="language-switcher">
            <a href="/en">English</a>
            <a href="/ar">العربية</a>
          </div>
        </body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.hasVisibleSwitcher).toBe(true);
    expect(result.alternates).toHaveLength(2);
  });

  it("detects visible language switcher by ID", () => {
    const html = `
      <html>
        <body>
          <div id="lang-switch">
            <a href="/en">EN</a>
            <a href="/ar">AR</a>
          </div>
        </body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.hasVisibleSwitcher).toBe(true);
  });

  it("detects language switcher by data attribute", () => {
    const html = `
      <html>
        <body>
          <nav data-language-selector>
            <a href="/en">English</a>
          </nav>
        </body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.hasVisibleSwitcher).toBe(true);
  });

  it("handles pages without language switcher", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" hreflang="en" href="https://example.com/en" />
        </head>
        <body>
          <nav>
            <a href="/about">About</a>
          </nav>
        </body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.hasVisibleSwitcher).toBe(false);
    expect(result.alternates).toHaveLength(1);
    expect(result.supportedLanguages).toEqual(["en"]);
  });

  it("handles empty HTML", () => {
    const result = extractLanguageSwitch({ ...baseEvidence, html: "<html><body></body></html>" });

    expect(result.hasVisibleSwitcher).toBe(false);
    expect(result.alternates).toHaveLength(0);
    expect(result.supportedLanguages).toHaveLength(0);
  });

  it("extracts x-default hreflang", () => {
    const html = `
      <html>
        <head>
          <link rel="alternate" hreflang="x-default" href="https://example.com" />
          <link rel="alternate" hreflang="en" href="https://example.com/en" />
        </head>
        <body></body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.alternates).toHaveLength(2);
    expect(result.supportedLanguages).toContain("x-default");
    expect(result.supportedLanguages).toContain("en");
  });

  it("detects language switcher with role attribute", () => {
    const html = `
      <html>
        <body>
          <ul role="language-switcher">
            <li><a href="/en">English</a></li>
          </ul>
        </body>
      </html>
    `;

    const result = extractLanguageSwitch({ ...baseEvidence, html });

    expect(result.hasVisibleSwitcher).toBe(true);
  });
});
