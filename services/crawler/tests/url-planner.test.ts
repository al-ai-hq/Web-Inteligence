import { describe, it, expect } from "vitest";
import { planUrls, bfsCrawl, mergeSitemapAndBfs } from "../src/url-planner.js";

// ---------------------------------------------------------------------------
// planUrls — single_page
// ---------------------------------------------------------------------------
describe("planUrls — single_page", () => {
  it("returns only root URL", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "single_page",
      maxPages: 10,
      maxDepth: 3,
    });
    expect(result).toEqual(["https://example.com/"]);
  });
});

// ---------------------------------------------------------------------------
// planUrls — priority_pages
// ---------------------------------------------------------------------------
describe("planUrls — priority_pages", () => {
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/low</loc><priority>0.1</priority></url>
  <url><loc>https://example.com/high</loc><priority>0.9</priority></url>
  <url><loc>https://example.com/mid</loc><priority>0.5</priority></url>
  <url><loc>https://example.com/top</loc><priority>1.0</priority></url>
</urlset>`;

  it("returns root + top N sitemap URLs by priority", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "priority_pages",
      maxPages: 4,
      maxDepth: 0,
      sitemapXml,
    });
    // parseSitemap sorts by priority desc: top(1.0), high(0.9), mid(0.5), low(0.1)
    // maxPages=4 → root + top 3: top, high, mid
    expect(result).toEqual([
      "https://example.com/",
      "https://example.com/top",
      "https://example.com/high",
      "https://example.com/mid",
    ]);
  });

  it("caps at maxPages", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "priority_pages",
      maxPages: 2,
      maxDepth: 0,
      sitemapXml,
    });
    // root + top 1 by priority = 2 entries
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://example.com/");
    expect(result[1]).toBe("https://example.com/top");
  });
});

// ---------------------------------------------------------------------------
// planUrls — full_bounded
// ---------------------------------------------------------------------------
describe("planUrls — full_bounded", () => {
  const mockFetchAndParse = async (url: string): Promise<string[]> => {
    const links: Record<string, string[]> = {
      "https://example.com/": ["https://example.com/page1", "https://example.com/page2"],
      "https://example.com/page1": ["https://example.com/page3"],
      "https://example.com/page2": [],
      "https://example.com/page3": [],
    };
    return links[url] ?? [];
  };

  it("does BFS up to maxDepth and maxPages", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "full_bounded",
      maxPages: 10,
      maxDepth: 2,
      fetchAndParse: mockFetchAndParse,
    });
    // BFS order: root, page1, page2, page3
    expect(result).toContain("https://example.com/");
    expect(result).toContain("https://example.com/page1");
    expect(result).toContain("https://example.com/page2");
    expect(result).toContain("https://example.com/page3");
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("stays within same origin", async () => {
    const fetchWithExternal = async (url: string): Promise<string[]> => {
      const links: Record<string, string[]> = {
        "https://example.com/": [
          "https://example.com/page1",
          "https://evil.com/steal",
        ],
        "https://example.com/page1": [],
      };
      return links[url] ?? [];
    };
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "full_bounded",
      maxPages: 10,
      maxDepth: 2,
      fetchAndParse: fetchWithExternal,
    });
    expect(result).not.toContain("https://evil.com/steal");
    expect(result).toContain("https://example.com/");
    expect(result).toContain("https://example.com/page1");
  });

  it("throws if fetchAndParse is not provided", async () => {
    await expect(
      planUrls({
        rootUrl: "https://example.com/",
        samplingMode: "full_bounded",
        maxPages: 10,
        maxDepth: 2,
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// planUrls — representative_sample
// ---------------------------------------------------------------------------
describe("planUrls — representative_sample", () => {
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/sitemap-a</loc><priority>0.9</priority></url>
  <url><loc>https://example.com/sitemap-b</loc><priority>0.5</priority></url>
</urlset>`;

  const mockFetchAndParse = async (url: string): Promise<string[]> => {
    const links: Record<string, string[]> = {
      "https://example.com/": ["https://example.com/bfs-1"],
      "https://example.com/bfs-1": [],
    };
    return links[url] ?? [];
  };

  it("merges sitemap and BFS URLs", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "representative_sample",
      maxPages: 10,
      maxDepth: 1,
      sitemapXml,
      fetchAndParse: mockFetchAndParse,
    });
    expect(result).toContain("https://example.com/sitemap-a");
    expect(result).toContain("https://example.com/bfs-1");
  });

  it("deduplicates URLs", async () => {
    const fetchOverlapping = async (url: string): Promise<string[]> => {
      const links: Record<string, string[]> = {
        "https://example.com/": ["https://example.com/sitemap-a"],
      };
      return links[url] ?? [];
    };
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "representative_sample",
      maxPages: 10,
      maxDepth: 1,
      sitemapXml,
      fetchAndParse: fetchOverlapping,
    });
    // sitemap-a should appear only once
    const count = result.filter((u) => u === "https://example.com/sitemap-a").length;
    expect(count).toBe(1);
  });

  it("caps at maxPages", async () => {
    const result = await planUrls({
      rootUrl: "https://example.com/",
      samplingMode: "representative_sample",
      maxPages: 2,
      maxDepth: 1,
      sitemapXml,
      fetchAndParse: mockFetchAndParse,
    });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("throws if fetchAndParse is not provided", async () => {
    await expect(
      planUrls({
        rootUrl: "https://example.com/",
        samplingMode: "representative_sample",
        maxPages: 10,
        maxDepth: 1,
        sitemapXml,
      })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// bfsCrawl
// ---------------------------------------------------------------------------
describe("bfsCrawl", () => {
  const mockFetchAndParse = async (url: string): Promise<string[]> => {
    const links: Record<string, string[]> = {
      "https://example.com/": ["https://example.com/page1", "https://example.com/page2"],
      "https://example.com/page1": ["https://example.com/page3"],
      "https://example.com/page2": [],
      "https://example.com/page3": [],
    };
    return links[url] ?? [];
  };

  it("with depth 0 returns only root", async () => {
    const result = await bfsCrawl(
      "https://example.com/",
      10,
      0,
      mockFetchAndParse
    );
    expect(result).toEqual(["https://example.com/"]);
  });

  it("discovers links breadth-first", async () => {
    const result = await bfsCrawl(
      "https://example.com/",
      10,
      2,
      mockFetchAndParse
    );
    expect(result).toContain("https://example.com/");
    expect(result).toContain("https://example.com/page1");
    expect(result).toContain("https://example.com/page2");
    expect(result).toContain("https://example.com/page3");
    // BFS order: root first, then depth-1, then depth-2
    expect(result[0]).toBe("https://example.com/");
  });

  it("respects maxPages limit", async () => {
    const result = await bfsCrawl(
      "https://example.com/",
      2,
      3,
      mockFetchAndParse
    );
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("stays within same origin", async () => {
    const fetchWithExternal = async (url: string): Promise<string[]> => {
      const links: Record<string, string[]> = {
        "https://example.com/": [
          "https://example.com/page1",
          "https://evil.com/steal",
          "http://example.com/page1", // different protocol
        ],
        "https://example.com/page1": [],
      };
      return links[url] ?? [];
    };
    const result = await bfsCrawl(
      "https://example.com/",
      10,
      1,
      fetchWithExternal
    );
    expect(result).not.toContain("https://evil.com/steal");
    expect(result).not.toContain("http://example.com/page1");
  });
});

// ---------------------------------------------------------------------------
// mergeSitemapAndBfs
// ---------------------------------------------------------------------------
describe("mergeSitemapAndBfs", () => {
  it("preserves sitemap-first order", () => {
    const result = mergeSitemapAndBfs(
      ["https://example.com/a", "https://example.com/b"],
      ["https://example.com/c", "https://example.com/d"],
      10
    );
    expect(result).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/d",
    ]);
  });

  it("deduplicates case-insensitively", () => {
    const result = mergeSitemapAndBfs(
      ["https://Example.com/Page"],
      ["https://example.com/page"],
      10
    );
    expect(result).toEqual(["https://Example.com/Page"]);
  });

  it("caps at maxPages", () => {
    const result = mergeSitemapAndBfs(
      ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
      ["https://example.com/d"],
      2
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("https://example.com/a");
    expect(result[1]).toBe("https://example.com/b");
  });
});
