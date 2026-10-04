export interface GscSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
}

export interface GscUrlInspectionResponse {
  inspectionResult?: {
    indexStatusResult?: {
      verdict: string;
      lastCrawlTime?: string;
      pageFetchState?: string;
    };
  };
}
