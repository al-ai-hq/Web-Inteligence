export interface ForbiddenCheckItem {
  field_name: string;
  new_value: string;
  evidence_citation?: string;
}

export function isForbidden(change: ForbiddenCheckItem): { forbidden: boolean; reason?: string } {
  if (change.field_name === "status" && change.new_value === "deleted") {
    return { forbidden: true, reason: "Page deletion is forbidden; use redirects or noindex" };
  }

  const hiddenTextPatterns = [
    /display\s*:\s*none/i,
    /visibility\s*:\s*hidden/i,
    /color\s*:\s*(#fff|white|transparent)/i,
  ];
  if (hiddenTextPatterns.some((p) => p.test(change.new_value))) {
    return { forbidden: true, reason: "Hidden text detected" };
  }

  if (change.field_name === "review" && !change.evidence_citation) {
    return { forbidden: true, reason: "Reviews must cite evidence" };
  }

  if (change.field_name === "meta_redirect" && /url=/i.test(change.new_value)) {
    return { forbidden: true, reason: "Cloaking detected: meta redirect to different content" };
  }

  const linkPattern = /<a\s[^>]*href=(?!['"]#)[^>]*>(?!.*rel=["']sponsored["'])/i;
  if (change.field_name === "content" && linkPattern.test(change.new_value)) {
    const hasSponsored = /rel=["']sponsored["']/i.test(change.new_value);
    if (!hasSponsored) {
      return {
        forbidden: true,
        reason: 'Link scheme detected: paid links without rel="sponsored"',
      };
    }
  }

  const words = change.new_value.toLowerCase().split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.floor(words.length * 0.3));
  for (const [, count] of freq) {
    if (count >= threshold) {
      return { forbidden: true, reason: "keyword stuffing detected" };
    }
  }

  return { forbidden: false };
}
