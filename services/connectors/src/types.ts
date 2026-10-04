export interface AuditContext {
  locale: "en" | "ar";
  tier: "free" | "rich" | "reduced" | "preview";
  auth?: {
    google?: {
      accessToken: string;
    };
  };
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
  gsc?: GscData;
  ga4?: Ga4Data;
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

export interface GscData {
  search_analytics: {
    date_range: { start: string; end: string };
    totals: {
      queries: number;
      clicks: number;
      impressions: number;
      ctr: number;
      average_position: number;
    };
    by_page: Array<{
      url: string;
      clicks: number;
      impressions: number;
      ctr: number;
      average_position: number;
    }>;
    by_country: Array<{
      country: string;
      clicks: number;
      impressions: number;
      ctr: number;
      average_position: number;
    }>;
    top_queries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      average_position: number;
    }>;
  };
  index_coverage: {
    important_pages_total: number;
    important_pages_indexed: number;
    indexed_ratio: number;
  };
  generative_ai?: {
    impressions: number;
  };
}

export interface Ga4Data {
  date_range: { start: string; end: string };
  timezone: string;
  pages: Array<{
    url: string;
    pageviews: number;
    unique_pageviews: number;
    average_time_on_page_seconds: number;
    bounce_rate: number;
    entrances: number;
    exits: number;
  }>;
}
