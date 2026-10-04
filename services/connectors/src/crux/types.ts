// services/connectors/src/crux/types.ts
export interface CruxApiResponse {
  record: {
    key: {
      origin: string;
    };
    metrics: {
      largest_contentful_paint: CruxMetric;
      first_input_delay: CruxMetric;
      cumulative_layout_shift: CruxMetric;
      effective_connection_type?: {
        category: string;
      };
    };
  };
}

export interface CruxMetric {
  good?: {
    percent: number;
  };
  needs_improvement?: {
    percent: number;
  };
  poor?: {
    percent: number;
  };
  category?: string;
}
