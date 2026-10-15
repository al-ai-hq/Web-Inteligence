export interface DimensionScore {
  score: number;
  coverage: number;
  criteria_count: number;
  applicable_count: number;
  not_applicable_count: number;
}

export interface ExperienceScoreResult {
  experience_effectiveness: number;
  dimensions: {
    design_hierarchy: DimensionScore;
    copy_and_positioning_clarity: DimensionScore;
    ux_and_navigation: DimensionScore;
    trust_and_proof: DimensionScore;
    conversion_path_and_measurement: DimensionScore;
  };
  coverage: number;
  confidence: "high" | "medium" | "low";
  fidelity_label: "assessed";
  methodology_version: string;
}
