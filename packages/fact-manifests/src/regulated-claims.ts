export interface Fact {
  statement: string;
}

export function flagRegulatedClaim(fact: Fact): {
  requires_review: boolean;
  topic: 'health' | 'finance' | 'legal' | null;
} {
  const healthKeywords = ['treat', 'cure', 'diagnose', 'medicine', 'drug'];
  const financeKeywords = ['invest', 'return', 'profit', 'interest', 'loan'];
  const legalKeywords = ['law', 'legal', 'court', 'liability', 'contract'];

  const statement = fact.statement.toLowerCase();

  if (healthKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'health' };
  }
  if (financeKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'finance' };
  }
  if (legalKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'legal' };
  }

  return { requires_review: false, topic: null };
}
