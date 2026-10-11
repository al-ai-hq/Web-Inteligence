export interface Citation {
  fact_id: string;
  draft_id: string;
  citation_text: string;
  url: string | null;
}

const citations: Citation[] = [];

export function trackCitation(citation: Citation): void {
  citations.push(citation);
}

export function getCitationsForFact(factId: string): Citation[] {
  return citations.filter(c => c.fact_id === factId);
}

export function getCitationsForDraft(draftId: string): Citation[] {
  return citations.filter(c => c.draft_id === draftId);
}

export function resetCitations(): void {
  citations.length = 0;
}
