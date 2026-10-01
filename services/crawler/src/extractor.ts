import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Heading {
  level: number; // 1-6
  text: string;
}

export interface ExtractedContent {
  headings: Heading[];
  links: string[]; // absolute URLs
  language?: string; // from <html lang> or <meta http-equiv="content-language">
  direction?: string; // from <html dir> or first <bdi dir>
  structuredData: unknown[]; // parsed JSON-LD objects
  textByteLength: number; // UTF-8 byte length of visible text
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
export function extractContent(html: string, baseUrl?: string): ExtractedContent {
  const $ = cheerio.load(html);

  // --- Headings ---
  const headings: Heading[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = parseInt(el.tagName.slice(1), 10);
    const text = $(el).text().trim();
    if (text) {
      headings.push({ level, text });
    }
  });

  // --- Links ---
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (baseUrl) {
      try {
        const absolute = new URL(href, baseUrl).href;
        links.push(absolute);
      } catch {
        // Invalid URL, skip
      }
    } else {
      links.push(href);
    }
  });

  // --- Language ---
  let language: string | undefined;
  const htmlLang = $("html").attr("lang");
  if (htmlLang) {
    language = htmlLang;
  } else {
    const metaLang = $('meta[http-equiv="content-language"]').attr("content");
    if (metaLang) {
      language = metaLang.trim();
    }
  }

  // --- Direction ---
  let direction: string | undefined;
  const htmlDir = $("html").attr("dir");
  if (htmlDir) {
    direction = htmlDir;
  } else {
    const bdiDir = $("bdi").first().attr("dir");
    if (bdiDir) {
      direction = bdiDir;
    }
  }

  // --- Structured data (JSON-LD) ---
  const structuredData: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      structuredData.push(parsed);
    } catch {
      // Invalid JSON, skip
    }
  });

  // --- Text content byte length ---
  $("script, style, noscript").remove();
  const visibleText = $.text();
  const textByteLength = Buffer.byteLength(visibleText, "utf-8");

  return {
    headings,
    links,
    language,
    direction,
    structuredData,
    textByteLength,
  };
}
