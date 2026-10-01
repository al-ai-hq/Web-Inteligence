export interface SitemapEntry {
  url: string;
  priority: number;
}

/**
 * Parse an XML sitemap and extract URLs with their priorities.
 * Handles both <urlset> (standard sitemap) and <sitemapindex> formats.
 * Results are sorted by priority descending (highest first).
 */
export function parseSitemap(sitemapXml: string): SitemapEntry[] {
  if (!sitemapXml || !sitemapXml.trim()) {
    return [];
  }

  // Decode XML entities in extracted text
  const decodeXml = (s: string): string =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

  const isSitemapIndex = /<sitemapindex[\s>]/i.test(sitemapXml);

  const entries: SitemapEntry[] = [];

  if (isSitemapIndex) {
    // Extract <loc> from each <sitemap> entry
    const sitemapBlocks = sitemapXml.match(/<sitemap[\s>]([\s\S]*?)<\/sitemap>/gi) ?? [];
    for (const block of sitemapBlocks) {
      const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(block);
      if (locMatch) {
        const url = decodeXml(locMatch[1]!.trim());
        if (url) {
          entries.push({ url, priority: 0.5 });
        }
      }
    }
  } else {
    // Extract <url> entries from <urlset>
    const urlBlocks = sitemapXml.match(/<url[\s>]([\s\S]*?)<\/url>/gi) ?? [];
    for (const block of urlBlocks) {
      const locMatch = /<loc>([\s\S]*?)<\/loc>/i.exec(block);
      if (!locMatch) continue;

      const url = decodeXml(locMatch[1]!.trim());
      if (!url) continue;

      const priorityMatch = /<priority>([\s\S]*?)<\/priority>/i.exec(block);
      let priority = 0.5;
      if (priorityMatch) {
        const parsed = Number(priorityMatch[1]!.trim());
        if (Number.isFinite(parsed)) {
          priority = parsed;
        }
      }

      entries.push({ url, priority });
    }
  }

  // Sort by priority descending
  entries.sort((a, b) => b.priority - a.priority);

  return entries;
}
