import { describe, it, expect } from "vitest";
import { parseSitemap } from "../src/sitemap-parser.js";

describe("parseSitemap", () => {
  it("parses a simple sitemap with URLs and priorities", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
    <priority>0.3</priority>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([
      { url: "https://example.com/page1", priority: 0.8 },
      { url: "https://example.com/page2", priority: 0.3 },
    ]);
  });

  it("defaults priority to 0.5 when not specified", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page1</loc>
  </url>
  <url>
    <loc>https://example.com/page2</loc>
    <priority>0.9</priority>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([
      { url: "https://example.com/page2", priority: 0.9 },
      { url: "https://example.com/page1", priority: 0.5 },
    ]);
  });

  it("sorts results by priority descending (highest first)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/low</loc>
    <priority>0.1</priority>
  </url>
  <url>
    <loc>https://example.com/high</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://example.com/mid</loc>
    <priority>0.5</priority>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([
      { url: "https://example.com/high", priority: 0.9 },
      { url: "https://example.com/mid", priority: 0.5 },
      { url: "https://example.com/low", priority: 0.1 },
    ]);
  });

  it("parses a sitemap index and extracts child sitemap URLs", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap1.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap2.xml</loc>
  </sitemap>
</sitemapindex>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([
      { url: "https://example.com/sitemap1.xml", priority: 0.5 },
      { url: "https://example.com/sitemap2.xml", priority: 0.5 },
    ]);
  });

  it("returns empty array for empty sitemap", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([]);
  });

  it("handles malformed XML gracefully without crashing", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/good</loc>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/missing-close
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://example.com/also-good</loc>
    <priority>0.3</priority>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    // Should not crash; should extract what it can
    expect(Array.isArray(result)).toBe(true);
    // At minimum the well-formed entries should be present
    const urls = result.map((e) => e.url);
    expect(urls).toContain("https://example.com/good");
  });

  it("handles sitemap with only loc elements (no priority tags)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/a</loc>
  </url>
  <url>
    <loc>https://example.com/b</loc>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toEqual([
      { url: "https://example.com/a", priority: 0.5 },
      { url: "https://example.com/b", priority: 0.5 },
    ]);
  });

  it("preserves URL exactly as specified without normalization", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/Path/To/Page?key=Value&amp;foo=bar#section</loc>
    <priority>0.7</priority>
  </url>
</urlset>`;
    const result = parseSitemap(xml);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://example.com/Path/To/Page?key=Value&foo=bar#section");
  });
});
