export interface CategoryResult {
  category: string;
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
}
