export interface AuditContext {
  locale: "en" | "ar";
  tier: "free" | "rich" | "reduced" | "preview";
}

export interface Connector {
  name: string;
  run(url: string, context: AuditContext): Promise<ConnectorResult>;
}

export type ConnectorResult =
  | { ok: true; connector: string; data: ConnectorData }
  | { ok: false; connector: string; unavailable_reason_key: string };

export interface ConnectorData {
  psi?: PsiData;
  crux?: CruxData;
}

export interface PsiData {
  core_web_vitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
  opportunities: Array<{
    id: string;
    title: string;
    savings_ms?: number;
    severity: "high" | "medium" | "low";
  }>;
}

export interface CruxData {
  metrics: {
    lcp: { good: number; needs_improvement: number; poor: number };
    fid: { good: number; needs_improvement: number; poor: number };
    cls: { good: number; needs_improvement: number; poor: number };
  };
  origin: string;
  effective_connection_type: string;
}
