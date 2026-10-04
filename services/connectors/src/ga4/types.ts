export interface Ga4DimensionValue {
  value: string;
}

export interface Ga4MetricValue {
  value: string;
}

export interface Ga4Row {
  dimensionValues: Ga4DimensionValue[];
  metricValues: Ga4MetricValue[];
}

export interface Ga4DataResponse {
  rows?: Ga4Row[];
  metadata?: {
    timezone?: string;
  };
  rowCount?: number;
}
