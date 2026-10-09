import type { VisibilityIntake, Citation, AccuracyIssue, MentionSpan, OwnerClass } from "./types.js";

export interface AnalysisResult {
  brand_mentioned: boolean;
  mention_spans: MentionSpan[];
  competitors_mentioned: string[];
  citations: Citation[];
  brand_url_cited: boolean;
  accuracy_issues: AccuracyIssue[];
}

const URL_REGEX = /https?:\/\/[^\s)"'>]+/g;

let citationCounter = 0;
let issueCounter = 0;

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifyUrl(url: string, intake: VisibilityIntake): OwnerClass {
  const domain = getDomain(url);
  if (!domain) return "unknown";
  if (domain === intake.brand_domain || domain.endsWith(`.${intake.brand_domain}`)) return "owned";
  if (intake.competitor_domains.some((cd) => domain === cd || domain.endsWith(`.${cd}`))) return "competitor";
  return "third_party";
}

function findMentions(text: string, intake: VisibilityIntake): { brandSpans: MentionSpan[]; competitorDomains: string[] } {
  const brandSpans: MentionSpan[] = [];
  const names = [intake.brand_name, ...intake.brand_aliases];

  for (const name of names) {
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const m0 = match[0]!;
      brandSpans.push({ start: match.index, end: match.index + m0.length, text: m0 });
    }
  }

  const competitorDomains: string[] = [];
  for (const cd of intake.competitor_domains) {
    const domainName = cd.replace(/\.\w+$/, "").replace(/^www\./, "");
    const regex = new RegExp(`\\b${escapeRegex(domainName)}\\b`, "gi");
    if (regex.test(text)) {
      competitorDomains.push(cd);
    }
  }

  return { brandSpans, competitorDomains };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkFacts(text: string, intake: VisibilityIntake, runId: string): AccuracyIssue[] {
  const issues: AccuracyIssue[] = [];
  for (const fact of intake.brand_facts) {
    if (!text.toLowerCase().includes(fact.claim.toLowerCase())) {
      const contradictingPatterns = [
        /\d{4}/g,
      ];
      for (const pattern of contradictingPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          const factNumbers = fact.claim.match(/\d{4}/g) ?? [];
          for (const fn of factNumbers) {
            if (matches.some((m) => m !== fn)) {
              issueCounter++;
              issues.push({
                issue_id: `ai-${issueCounter}`,
                run_id: runId,
                issue_type: fact.category === "location" ? "location" : "other",
                claim: `Response contradicts: ${fact.claim}`,
                status: "open",
                escalation: null,
              });
              break;
            }
          }
        }
      }
    }
  }
  return issues;
}

export function analyzeResponse(
  responseText: string,
  intake: VisibilityIntake,
  promptFamily: string,
): AnalysisResult {
  const { brandSpans, competitorDomains } = findMentions(responseText, intake);

  const urls = extractUrls(responseText);
  citationCounter = 0;
  const citations: Citation[] = urls.map((url) => {
    citationCounter++;
    return {
      citation_id: `c-${citationCounter}`,
      url,
      owner_class: classifyUrl(url, intake),
      position: citationCounter,
      in_final_answer: true,
      fetched_evidence_id: null,
    };
  });

  const brandUrlCited = citations.some((c) => c.owner_class === "owned");

  const accuracyIssues = promptFamily === "brand_facts" || promptFamily === "branded"
    ? checkFacts(responseText, intake, "pending")
    : [];

  return {
    brand_mentioned: brandSpans.length > 0,
    mention_spans: brandSpans,
    competitors_mentioned: competitorDomains,
    citations,
    brand_url_cited: brandUrlCited,
    accuracy_issues: accuracyIssues,
  };
}
