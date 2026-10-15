export interface AuditEvidence {
  headings: string[];
  hasProduct: boolean;
  hasReviews: boolean;
}

export function recommendSchema(evidence: AuditEvidence): string[] {
  const recommendations: string[] = [];

  const faqPattern = /\?$/;
  if (evidence.headings.some((h) => faqPattern.test(h))) {
    recommendations.push("FAQPage");
  }

  if (evidence.hasProduct) {
    recommendations.push("Product");
  }

  if (evidence.hasReviews) {
    recommendations.push("AggregateRating");
  }

  return recommendations;
}
