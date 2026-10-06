/**
 * Shared evaluator helpers.
 */

/**
 * Symmetric word-overlap ratio between two strings.
 * Returns 0..1 representing the Jaccard-like overlap of significant words
 * (length > 3) from both strings, normalised by the smaller set.
 */
export function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size);
}

/**
 * Asymmetric word-overlap ratio between two strings.
 * Returns 0..1 representing the overlap of significant words (length > 2)
 * from both strings, normalised by the length of the first string's word array.
 * Uses array-based counting (duplicates are preserved, not deduplicated).
 *
 * This is the original algorithm used by structured-data consistency checks.
 */
export function wordOverlapAsymmetric(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (wordsA.length === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.includes(w)) overlap++;
  }
  return overlap / wordsA.length;
}
