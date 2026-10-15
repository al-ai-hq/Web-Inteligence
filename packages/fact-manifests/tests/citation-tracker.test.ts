import { describe, it, expect, beforeEach } from "vitest";
import {
  trackCitation,
  getCitationsForFact,
  getCitationsForDraft,
  resetCitations,
} from "../src/citation-tracker.js";

describe("citation-tracker", () => {
  beforeEach(() => {
    resetCitations();
  });

  it("tracks a citation from fact to draft", () => {
    trackCitation({
      fact_id: "fact-1",
      draft_id: "draft-1",
      citation_text: "As stated in...",
      url: null,
    });
    const citations = getCitationsForFact("fact-1");
    expect(citations).toHaveLength(1);
    expect(citations[0]!.draft_id).toBe("draft-1");
  });

  it("retrieves all citations for a draft", () => {
    trackCitation({
      fact_id: "fact-1",
      draft_id: "draft-2",
      citation_text: "Citation 1",
      url: null,
    });
    trackCitation({
      fact_id: "fact-2",
      draft_id: "draft-2",
      citation_text: "Citation 2",
      url: null,
    });
    const citations = getCitationsForDraft("draft-2");
    expect(citations).toHaveLength(2);
  });
});
