// services/connectors/src/psi/types.ts
export interface PsiApiResponse {
  lighthouseResult: {
    audits: Record<string, PsiAudit>;
  };
}

export interface PsiAudit {
  id: string;
  title: string;
  numericValue?: number;
  score?: number;
  details?: {
    items?: Array<{
      url?: string;
      wastedMs?: number;
    }>;
  };
}
