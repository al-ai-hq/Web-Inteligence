import type { PromptRun, Citation, LostPrompt } from "./types.js";

export function findLostPrompts(runs: PromptRun[], _citations: Citation[]): LostPrompt[] {
  const lostByPrompt = new Map<string, { run: PromptRun; urls: string[] }>();

  for (const run of runs) {
    if (run.status !== "valid") continue;
    if (run.brand_mentioned) continue;
    if (!run.competitors_mentioned || run.competitors_mentioned.length === 0) continue;

    const existing = lostByPrompt.get(run.prompt_id);
    const urls = run.cited_urls ?? [];
    if (existing) {
      existing.urls.push(...urls);
    } else {
      lostByPrompt.set(run.prompt_id, { run, urls: [...urls] });
    }
  }

  const fourWeeksMs = 4 * 7 * 24 * 60 * 60 * 1000;
  const recheckAfter = new Date(Date.now() + fourWeeksMs);

  return Array.from(lostByPrompt.values()).map(({ run, urls }) => ({
    prompt_id: run.prompt_id,
    prompt_text: run.final_prompt,
    competitor_cited_urls: [...new Set(urls)],
    gap_note: `Competitors cited in response but brand not mentioned. Competitors: ${run.competitors_mentioned.join(", ")}`,
    recheck_after: recheckAfter,
  }));
}
