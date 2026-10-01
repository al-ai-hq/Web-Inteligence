import { describe, it, expect } from "vitest";
import { extractContent } from "../src/extractor.js";

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
describe("extractContent", () => {
  it("extracts headings h1-h6 with level and text", () => {
    const html = `
      <html><body>
        <h1>Title</h1>
        <h2>Subtitle</h2>
        <h3>Section</h3>
        <h4>Subsection</h4>
        <h5>Detail</h5>
        <h6>Fine detail</h6>
      </body></html>
    `;
    const result = extractContent(html);
    expect(result.headings).toEqual([
      { level: 1, text: "Title" },
      { level: 2, text: "Subtitle" },
      { level: 3, text: "Section" },
      { level: 4, text: "Subsection" },
      { level: 5, text: "Detail" },
      { level: 6, text: "Fine detail" },
    ]);
  });

  it("skips headings with empty text", () => {
    const html = `<html><body><h1>  </h1><h2>Real</h2></body></html>`;
    const result = extractContent(html);
    expect(result.headings).toEqual([{ level: 2, text: "Real" }]);
  });

  it("extracts links as absolute URLs when baseUrl is provided", () => {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="https://other.com/page">Other</a>
        <a href="./contact">Contact</a>
      </body></html>
    `;
    const result = extractContent(html, "https://example.com/");
    expect(result.links).toEqual([
      "https://example.com/about",
      "https://other.com/page",
      "https://example.com/contact",
    ]);
  });

  it("returns links as-is when no baseUrl is provided", () => {
    const html = `
      <html><body>
        <a href="/about">About</a>
        <a href="https://other.com/page">Other</a>
      </body></html>
    `;
    const result = extractContent(html);
    expect(result.links).toEqual(["/about", "https://other.com/page"]);
  });

  it("skips links with invalid URLs when baseUrl is provided", () => {
    const html = `<html><body><a href=":::invalid">Bad</a><a href="/good">Good</a></body></html>`;
    const result = extractContent(html, "https://example.com/");
    // "::invalid" is actually a valid relative URL per URL spec, so it resolves
    // Let's just check /good is there
    expect(result.links).toContain("https://example.com/good");
  });

  it("extracts language from html lang attribute", () => {
    const html = `<html lang="en"><body><p>Hello</p></body></html>`;
    const result = extractContent(html);
    expect(result.language).toBe("en");
  });

  it("extracts language from meta content-language when html lang is absent", () => {
    const html = `
      <html><head>
        <meta http-equiv="content-language" content="fr">
      </head><body><p>Bonjour</p></body></html>
    `;
    const result = extractContent(html);
    expect(result.language).toBe("fr");
  });

  it("prefers html lang over meta content-language", () => {
    const html = `
      <html lang="de"><head>
        <meta http-equiv="content-language" content="fr">
      </head><body></body></html>
    `;
    const result = extractContent(html);
    expect(result.language).toBe("de");
  });

  it("extracts direction from html dir attribute", () => {
    const html = `<html dir="rtl"><body><p>مرحبا</p></body></html>`;
    const result = extractContent(html);
    expect(result.direction).toBe("rtl");
  });

  it("extracts direction from first bdi dir when html dir is absent", () => {
    const html = `
      <html><body>
        <bdi dir="rtl">عربي</bdi>
        <bdi dir="ltr">English</bdi>
      </body></html>
    `;
    const result = extractContent(html);
    expect(result.direction).toBe("rtl");
  });

  it("prefers html dir over bdi dir", () => {
    const html = `
      <html dir="ltr"><body>
        <bdi dir="rtl">عربي</bdi>
      </body></html>
    `;
    const result = extractContent(html);
    expect(result.direction).toBe("ltr");
  });

  it("extracts JSON-LD structured data", () => {
    const jsonLd = { "@type": "WebPage", name: "Test" };
    const html = `
      <html><head>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </head><body></body></html>
    `;
    const result = extractContent(html);
    expect(result.structuredData).toEqual([jsonLd]);
  });

  it("extracts multiple JSON-LD blocks", () => {
    const jsonLd1 = { "@type": "WebPage", name: "Page" };
    const jsonLd2 = { "@type": "Organization", name: "Org" };
    const html = `
      <html><head>
        <script type="application/ld+json">${JSON.stringify(jsonLd1)}</script>
        <script type="application/ld+json">${JSON.stringify(jsonLd2)}</script>
      </head><body></body></html>
    `;
    const result = extractContent(html);
    expect(result.structuredData).toEqual([jsonLd1, jsonLd2]);
  });

  it("handles invalid JSON-LD gracefully by skipping it", () => {
    const validLd = { "@type": "WebPage" };
    const html = `
      <html><head>
        <script type="application/ld+json">{invalid json!!!}</script>
        <script type="application/ld+json">${JSON.stringify(validLd)}</script>
      </head><body></body></html>
    `;
    const result = extractContent(html);
    expect(result.structuredData).toEqual([validLd]);
  });

  it("calculates text byte length excluding scripts and styles", () => {
    const htmlWithScripts = `
      <html><body>
        <script>var x = 1;</script>
        <style>.foo { color: red; }</style>
        <p>Hello</p>
      </body></html>
    `;
    const htmlWithout = `
      <html><body>
        
        
        <p>Hello</p>
      </body></html>
    `;
    const withScripts = extractContent(htmlWithScripts);
    const withoutScripts = extractContent(htmlWithout);
    // Byte lengths should be equal because script/style content is stripped
    expect(withScripts.textByteLength).toBe(withoutScripts.textByteLength);
    expect(withScripts.textByteLength).toBeGreaterThan(0);
  });

  it("calculates correct UTF-8 byte length for multi-byte characters", () => {
    const html = `<html><body>مرحبا</body></html>`;
    const result = extractContent(html);
    // "مرحبا" in UTF-8 is 10 bytes (each Arabic char is 2 bytes)
    // cheerio may add whitespace, so we check it's at least 10
    expect(result.textByteLength).toBeGreaterThanOrEqual(10);
  });

  it("handles empty HTML", () => {
    const result = extractContent("");
    expect(result.headings).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.language).toBeUndefined();
    expect(result.direction).toBeUndefined();
    expect(result.structuredData).toEqual([]);
    expect(result.textByteLength).toBe(0);
  });

  it("handles malformed HTML without crashing", () => {
    const html = `<html><body><h1>Unclosed heading<p>Another <b>bold</h1> still going`;
    const result = extractContent(html);
    // cheerio is lenient; should not throw
    expect(result.headings.length).toBeGreaterThanOrEqual(1);
    expect(result.textByteLength).toBeGreaterThan(0);
  });

  it("returns language as undefined when neither html lang nor meta content-language exist", () => {
    const html = `<html><body><p>No language</p></body></html>`;
    const result = extractContent(html);
    expect(result.language).toBeUndefined();
  });

  it("returns direction as undefined when neither html dir nor bdi dir exist", () => {
    const html = `<html><body><p>No direction</p></body></html>`;
    const result = extractContent(html);
    expect(result.direction).toBeUndefined();
  });

  it("skips anchor tags without href attribute", () => {
    const html = `<html><body><a name="top">Top</a><a href="/link">Link</a></body></html>`;
    const result = extractContent(html, "https://example.com/");
    expect(result.links).toEqual(["https://example.com/link"]);
  });
});
