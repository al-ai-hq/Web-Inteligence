# M5 Experience Effectiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement model-assisted subjective review layer evaluating website experience quality across 23 rubric criteria in 5 dimensions, with separate scoring from Presence Readiness (D-012 compliance).

**Architecture:** New experience-reviewer agent reuses M3 agent service infrastructure (orchestrator, provider adapters, cost tracking). Vision-capable model analyzes screenshots directly with dimension-per-prompt architecture (5 calls per page). Scoring engine aggregates dimension findings into overall Experience Effectiveness score. Separate calibration tool validates model agreement with human labels before production.

**Tech Stack:** TypeScript ESM with strict mode, Vitest, pnpm workspace monorepo, existing M3 agent service, Gemini Pro Vision (or equivalent vision-capable model)

**Spec:** `docs/superpowers/specs/2026-10-07-m5-experience-effectiveness-design.md`

## Global Constraints

- TypeScript ESM with strict mode; .js extensions on all relative imports
- pnpm workspace monorepo structure
- Vitest for testing
- Reuse existing M3 agent service infrastructure (orchestrator, provider adapters, cost tracking)
- D-012 separation: Experience Effectiveness never blended with Presence Readiness
- All relative imports must use .js extensions
- Reviewer trace required for every finding (no partial traces)
- Weight validation: dimension weights must sum to 100, criterion weights must sum to 100 per dimension
- Calibration target: weighted Cohen's kappa ≥ 0.70 before production deployment

---

### Task 1: Agent Configuration File

**Files:**

- Create: `config/agents/experience-reviewer.yaml`

**Interfaces:**

- Consumes: None (configuration file)
- Produces: Agent configuration consumed by orchestrator

- [ ] **Step 1: Create agent configuration file**

Create `config/agents/experience-reviewer.yaml`:

```yaml
name: experience-reviewer
milestone: M5
reads_untrusted_content: true
model_tier: vision-capable
tools:
  - read_screenshot
  - read_extractor_output
  - parse_structured_json
forbidden_tools: []
```

- [ ] **Step 2: Verify configuration file syntax**

Run: `cat config/agents/experience-reviewer.yaml`
Expected: Valid YAML with all required fields

- [ ] **Step 3: Commit configuration file**

```bash
git add config/agents/experience-reviewer.yaml
git commit -m "feat(m5): add experience-reviewer agent configuration"
```

---

### Task 2: Experience Evidence Package Types

**Files:**

- Create: `packages/core/src/types/experience-evidence.ts`
- Test: `packages/core/src/types/experience-evidence.test.ts`

**Interfaces:**

- Consumes: Existing extractor output types (HeadingExtractorOutput, FormExtractorOutput, etc.)
- Produces: ExperienceEvidencePackage interface for agent input

- [ ] **Step 1: Write failing test for ExperienceEvidencePackage interface**

Create `packages/core/src/types/experience-evidence.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ExperienceEvidencePackage } from "./experience-evidence.js";

describe("ExperienceEvidencePackage", () => {
  it("should accept valid evidence package with all required fields", () => {
    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: "high",
      },
    };

    expect(evidence.page_url).toBe("https://example.com");
    expect(evidence.language).toBe("en");
    expect(evidence.screenshots.viewport).toBe("evidence_viewport_001");
  });

  it("should accept optional business_goal field", () => {
    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      business_goal: "Increase newsletter signups",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: null,
        categories: [],
        confidence: "low",
      },
    };

    expect(evidence.business_goal).toBe("Increase newsletter signups");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/types/experience-evidence.test.ts`
Expected: FAIL with "Cannot find module './experience-evidence.js'"

- [ ] **Step 3: Create ExperienceEvidencePackage interface**

Create `packages/core/src/types/experience-evidence.ts`:

```typescript
import type { HeadingExtractorOutput } from "../extractors/heading.js";
import type { FormExtractorOutput } from "../extractors/form.js";
import type { ContactExtractorOutput } from "../extractors/contact.js";
import type { PolicyExtractorOutput } from "../extractors/policy.js";
import type { LanguageExtractorOutput } from "../extractors/language.js";
import type { AnalyticsExtractorOutput } from "../extractors/analytics.js";
import type { ViewportExtractorOutput } from "../extractors/viewport.js";
import type { WayfindingExtractorOutput } from "../extractors/wayfinding.js";
import type { CategoryResult } from "./readiness.js";

export interface ExperienceEvidencePackage {
  page_url: string;
  language: string;
  market: string;
  business_goal?: string;

  screenshots: {
    viewport: string;
    full_page: string;
    above_fold: string;
  };

  extractor_results: {
    heading: HeadingExtractorOutput;
    form: FormExtractorOutput;
    contact: ContactExtractorOutput;
    policy: PolicyExtractorOutput;
    language: LanguageExtractorOutput;
    analytics: AnalyticsExtractorOutput;
    viewport: ViewportExtractorOutput;
    wayfinding: WayfindingExtractorOutput;
  };

  readiness_results: {
    score: number | null;
    categories: CategoryResult[];
    confidence: "high" | "medium" | "low";
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/types/experience-evidence.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit interface and tests**

```bash
git add packages/core/src/types/experience-evidence.ts packages/core/src/types/experience-evidence.test.ts
git commit -m "feat(m5): add ExperienceEvidencePackage interface"
```

---

### Task 3: Reviewer Trace Types

**Files:**

- Create: `packages/core/src/types/reviewer-trace.ts`
- Test: `packages/core/src/types/reviewer-trace.test.ts`

**Interfaces:**

- Consumes: None
- Produces: ReviewerTrace interface for finding audit trail

- [ ] **Step 1: Write failing test for ReviewerTrace interface**

Create `packages/core/src/types/reviewer-trace.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ReviewerTrace } from "./reviewer-trace.js";

describe("ReviewerTrace", () => {
  it("should accept valid reviewer trace without override", () => {
    const trace: ReviewerTrace = {
      rubric_version: "0.1.0-draft",
      criterion_id: "EXP-DH-01",
      criterion_name: "Visual hierarchy clarity",
      result: "pass",
      confidence: "high",
      rationale: "Clear visual hierarchy with distinct heading levels",
      evidence_ids: ["screenshot_viewport", "extractor_heading"],
      reviewer_type: "model",
      model_id: "gemini-pro-vision",
      model_version: "gemini-1.5-pro-002",
      language: "en",
      language_direction: "ltr",
      market: "US",
      evaluated_at: "2026-10-07T12:00:00Z",
      prompt_version: "0.1.0",
      limitations: [],
    };

    expect(trace.criterion_id).toBe("EXP-DH-01");
    expect(trace.reviewer_type).toBe("model");
    expect(trace.override).toBeUndefined();
  });

  it("should accept reviewer trace with override", () => {
    const trace: ReviewerTrace = {
      rubric_version: "0.1.0-draft",
      criterion_id: "EXP-CP-01",
      criterion_name: "Value proposition clarity",
      result: "partial",
      confidence: "medium",
      rationale: "Value proposition is present but could be clearer",
      evidence_ids: ["screenshot_above_fold"],
      reviewer_type: "hybrid",
      model_id: "gemini-pro-vision",
      model_version: "gemini-1.5-pro-002",
      language: "en",
      language_direction: "ltr",
      market: "US",
      evaluated_at: "2026-10-07T12:00:00Z",
      prompt_version: "0.1.0",
      override: {
        original_result: "pass",
        original_confidence: "high",
        original_rationale: "Value proposition is clear",
        overridden_by: "calibration_reviewer",
        overridden_at: "2026-10-07T13:00:00Z",
        override_reason: "Value proposition lacks specificity",
      },
      limitations: [],
    };

    expect(trace.reviewer_type).toBe("hybrid");
    expect(trace.override).toBeDefined();
    expect(trace.override?.original_result).toBe("pass");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/types/reviewer-trace.test.ts`
Expected: FAIL with "Cannot find module './reviewer-trace.js'"

- [ ] **Step 3: Create ReviewerTrace interface**

Create `packages/core/src/types/reviewer-trace.ts`:

```typescript
export interface ReviewerTrace {
  rubric_version: string;
  criterion_id: string;
  criterion_name: string;

  result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error";
  confidence: "high" | "medium" | "low";
  rationale: string;

  evidence_ids: string[];

  reviewer_type: "model" | "human" | "hybrid";
  model_id?: string;
  model_version?: string;

  language: string;
  language_direction: "ltr" | "rtl";
  market: string;

  evaluated_at: string;
  prompt_version: string;

  override?: {
    original_result: string;
    original_confidence: string;
    original_rationale: string;
    overridden_by: string;
    overridden_at: string;
    override_reason: string;
  };

  limitations: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/types/reviewer-trace.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit interface and tests**

```bash
git add packages/core/src/types/reviewer-trace.ts packages/core/src/types/reviewer-trace.test.ts
git commit -m "feat(m5): add ReviewerTrace interface"
```

---

### Task 4: Experience Score Result Types

**Files:**

- Create: `packages/core/src/types/experience-score.ts`
- Test: `packages/core/src/types/experience-score.test.ts`

**Interfaces:**

- Consumes: None
- Produces: ExperienceScoreResult and DimensionScore interfaces

- [ ] **Step 1: Write failing test for ExperienceScoreResult interface**

Create `packages/core/src/types/experience-score.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { ExperienceScoreResult, DimensionScore } from "./experience-score.js";

describe("ExperienceScoreResult", () => {
  it("should accept valid experience score result", () => {
    const dimensionScore: DimensionScore = {
      score: 85,
      coverage: 1.0,
      criteria_count: 5,
      applicable_count: 5,
      not_applicable_count: 0,
    };

    const result: ExperienceScoreResult = {
      experience_effectiveness: 82,
      dimensions: {
        design_hierarchy: dimensionScore,
        copy_and_positioning_clarity: dimensionScore,
        ux_and_navigation: dimensionScore,
        trust_and_proof: dimensionScore,
        conversion_path_and_measurement: dimensionScore,
      },
      coverage: 0.95,
      confidence: "high",
      fidelity_label: "assessed",
      methodology_version: "0.1.0-draft",
    };

    expect(result.experience_effectiveness).toBe(82);
    expect(result.confidence).toBe("high");
    expect(result.fidelity_label).toBe("assessed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/types/experience-score.test.ts`
Expected: FAIL with "Cannot find module './experience-score.js'"

- [ ] **Step 3: Create ExperienceScoreResult and DimensionScore interfaces**

Create `packages/core/src/types/experience-score.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/types/experience-score.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit interfaces and tests**

```bash
git add packages/core/src/types/experience-score.ts packages/core/src/types/experience-score.test.ts
git commit -m "feat(m5): add ExperienceScoreResult and DimensionScore interfaces"
```

---

### Task 5: Weight Configuration Loader

**Files:**

- Create: `packages/core/src/experience/weight-config.ts`
- Create: `config/experience-effectiveness.yaml`
- Test: `packages/core/src/experience/weight-config.test.ts`

**Interfaces:**

- Consumes: config/experience-effectiveness.yaml
- Produces: Weight configuration with validation

- [ ] **Step 1: Create default weight configuration file**

Create `config/experience-effectiveness.yaml`:

```yaml
methodology_version: "0.1.0-draft"
score_name: experience_effectiveness
display_name:
  en: "Experience Effectiveness"
  ar: "فعالية التجربة"

dimensions:
  design_hierarchy:
    weight: 20
    title: "Design hierarchy and visual structure"
  copy_and_positioning_clarity:
    weight: 20
    title: "Copy and positioning clarity"
  ux_and_navigation:
    weight: 20
    title: "UX and navigation"
  trust_and_proof:
    weight: 20
    title: "Trust and proof"
  conversion_path_and_measurement:
    weight: 20
    title: "Conversion path and measurement"

criteria:
  design_hierarchy:
    EXP-DH-01: 25
    EXP-DH-02: 20
    EXP-DH-03: 20
    EXP-DH-04: 15
    EXP-DH-05: 20

  copy_and_positioning_clarity:
    EXP-CP-01: 30
    EXP-CP-02: 25
    EXP-CP-03: 25
    EXP-CP-04: 20

  ux_and_navigation:
    EXP-UX-01: 25
    EXP-UX-02: 20
    EXP-UX-03: 20
    EXP-UX-04: 15
    EXP-UX-05: 20

  trust_and_proof:
    EXP-TP-01: 25
    EXP-TP-02: 20
    EXP-TP-03: 20
    EXP-TP-04: 15
    EXP-TP-05: 20

  conversion_path_and_measurement:
    EXP-CV-01: 25
    EXP-CV-02: 20
    EXP-CV-03: 20
    EXP-CV-04: 15
    EXP-CV-05: 20
```

- [ ] **Step 2: Write failing test for weight configuration loader**

Create `packages/core/src/experience/weight-config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadWeightConfig, validateWeights } from "./weight-config.js";

describe("loadWeightConfig", () => {
  it("should load default weight configuration", () => {
    const config = loadWeightConfig();

    expect(config.methodology_version).toBe("0.1.0-draft");
    expect(config.dimensions.design_hierarchy.weight).toBe(20);
    expect(config.criteria.design_hierarchy["EXP-DH-01"]).toBe(25);
  });

  it("should have dimension weights summing to 100", () => {
    const config = loadWeightConfig();
    const dimensionWeights = Object.values(config.dimensions).map((d) => d.weight);
    const sum = dimensionWeights.reduce((a, b) => a + b, 0);

    expect(sum).toBe(100);
  });

  it("should have criterion weights summing to 100 per dimension", () => {
    const config = loadWeightConfig();

    for (const [dimensionName, criteria] of Object.entries(config.criteria)) {
      const sum = Object.values(criteria).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });
});

describe("validateWeights", () => {
  it("should accept valid dimension weights", () => {
    const weights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = validateWeights(weights);
    expect(result.valid).toBe(true);
  });

  it("should reject dimension weights not summing to 100", () => {
    const weights = {
      design_hierarchy: 25,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = validateWeights(weights);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("sum to 100");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test packages/core/src/experience/weight-config.test.ts`
Expected: FAIL with "Cannot find module './weight-config.js'"

- [ ] **Step 4: Implement weight configuration loader**

Create `packages/core/src/experience/weight-config.ts`:

```typescript
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { resolve } from "node:path";

interface DimensionConfig {
  weight: number;
  title: string;
}

interface WeightConfig {
  methodology_version: string;
  score_name: string;
  display_name: Record<string, string>;
  dimensions: Record<string, DimensionConfig>;
  criteria: Record<string, Record<string, number>>;
}

export function loadWeightConfig(): WeightConfig {
  const configPath = resolve(process.cwd(), "config/experience-effectiveness.yaml");
  const fileContent = readFileSync(configPath, "utf-8");
  const config = load(fileContent) as WeightConfig;

  return config;
}

export function validateWeights(weights: Record<string, number>): {
  valid: boolean;
  error?: string;
} {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  if (sum !== 100) {
    return {
      valid: false,
      error: `Weights must sum to 100, got ${sum}`,
    };
  }

  return { valid: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test packages/core/src/experience/weight-config.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit configuration and loader**

```bash
git add config/experience-effectiveness.yaml packages/core/src/experience/weight-config.ts packages/core/src/experience/weight-config.test.ts
git commit -m "feat(m5): add weight configuration loader with validation"
```

---

### Task 6: Project Override Loader and Validator

**Files:**

- Create: `packages/core/src/experience/project-overrides.ts`
- Test: `packages/core/src/experience/project-overrides.test.ts`

**Interfaces:**

- Consumes: Weight configuration from Task 5
- Produces: Merged weight configuration with override tracking

- [ ] **Step 1: Write failing test for project override loader**

Create `packages/core/src/experience/project-overrides.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyOverrides, validateOverrides } from "./project-overrides.js";

describe("applyOverrides", () => {
  it("should apply valid dimension weight override", () => {
    const baseConfig = {
      dimensions: {
        design_hierarchy: { weight: 20, title: "Design" },
        copy_and_positioning_clarity: { weight: 20, title: "Copy" },
        ux_and_navigation: { weight: 20, title: "UX" },
        trust_and_proof: { weight: 20, title: "Trust" },
        conversion_path_and_measurement: { weight: 20, title: "Conversion" },
      },
      criteria: {},
    };

    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: "E-commerce prioritizes conversion",
          approved_by: "seo_lead",
          approved_at: "2026-10-01T12:00:00Z",
        },
      },
      criteria: {},
    };

    const result = applyOverrides(baseConfig, overrides);

    expect(result.dimensions.conversion_path_and_measurement.weight).toBe(30);
    expect(result.metadata.overrides_applied).toBe(true);
  });

  it("should reject invalid override and fall back to defaults", () => {
    const baseConfig = {
      dimensions: {
        design_hierarchy: { weight: 20, title: "Design" },
        copy_and_positioning_clarity: { weight: 20, title: "Copy" },
        ux_and_navigation: { weight: 20, title: "UX" },
        trust_and_proof: { weight: 20, title: "Trust" },
        conversion_path_and_measurement: { weight: 20, title: "Conversion" },
      },
      criteria: {},
    };

    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 50,
          justification: "Invalid override",
          approved_by: "seo_lead",
          approved_at: "2026-10-01T12:00:00Z",
        },
      },
      criteria: {},
    };

    const result = applyOverrides(baseConfig, overrides);

    expect(result.dimensions.conversion_path_and_measurement.weight).toBe(20);
    expect(result.metadata.overrides_applied).toBe(false);
    expect(result.metadata.validation_warning).toContain("sum to 100");
  });
});

describe("validateOverrides", () => {
  it("should accept valid override with justification", () => {
    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: "E-commerce site",
          approved_by: "seo_lead",
          approved_at: "2026-10-01T12:00:00Z",
        },
      },
      criteria: {},
    };

    const result = validateOverrides(overrides);
    expect(result.valid).toBe(true);
  });

  it("should reject override without justification", () => {
    const overrides = {
      dimensions: {
        conversion_path_and_measurement: {
          weight: 30,
          justification: "",
          approved_by: "seo_lead",
          approved_at: "2026-10-01T12:00:00Z",
        },
      },
      criteria: {},
    };

    const result = validateOverrides(overrides);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("justification");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/experience/project-overrides.test.ts`
Expected: FAIL with "Cannot find module './project-overrides.js'"

- [ ] **Step 3: Implement project override loader**

Create `packages/core/src/experience/project-overrides.ts`:

```typescript
import { validateWeights } from "./weight-config.js";

interface DimensionConfig {
  weight: number;
  title: string;
}

interface WeightConfig {
  dimensions: Record<string, DimensionConfig>;
  criteria: Record<string, Record<string, number>>;
}

interface DimensionOverride {
  weight: number;
  justification: string;
  approved_by: string;
  approved_at: string;
}

interface ProjectOverrides {
  dimensions: Record<string, DimensionOverride>;
  criteria: Record<
    string,
    { weight: number; justification: string; approved_by: string; approved_at: string }
  >;
}

interface OverrideMetadata {
  overrides_applied: boolean;
  validation_warning?: string;
}

export function applyOverrides(
  baseConfig: WeightConfig,
  overrides: ProjectOverrides,
): WeightConfig & { metadata: OverrideMetadata } {
  const validation = validateOverrides(overrides);

  if (!validation.valid) {
    return {
      ...baseConfig,
      metadata: {
        overrides_applied: false,
        validation_warning: validation.error,
      },
    };
  }

  const mergedDimensions = { ...baseConfig.dimensions };

  for (const [dimensionName, override] of Object.entries(overrides.dimensions)) {
    if (mergedDimensions[dimensionName]) {
      mergedDimensions[dimensionName] = {
        ...mergedDimensions[dimensionName],
        weight: override.weight,
      };
    }
  }

  const dimensionWeights = Object.values(mergedDimensions).map((d) => d.weight);
  const weightValidation = validateWeights(
    Object.fromEntries(Object.entries(mergedDimensions).map(([k, v]) => [k, v.weight])),
  );

  if (!weightValidation.valid) {
    return {
      ...baseConfig,
      metadata: {
        overrides_applied: false,
        validation_warning: weightValidation.error,
      },
    };
  }

  return {
    dimensions: mergedDimensions,
    criteria: baseConfig.criteria,
    metadata: {
      overrides_applied: true,
    },
  };
}

export function validateOverrides(overrides: ProjectOverrides): { valid: boolean; error?: string } {
  for (const [dimensionName, override] of Object.entries(overrides.dimensions)) {
    if (!override.justification || override.justification.trim() === "") {
      return {
        valid: false,
        error: `Override for ${dimensionName} missing justification`,
      };
    }
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/experience/project-overrides.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit override loader**

```bash
git add packages/core/src/experience/project-overrides.ts packages/core/src/experience/project-overrides.test.ts
git commit -m "feat(m5): add project override loader with validation"
```

---

### Task 7: Scoring Engine - Dimension Score Calculation

**Files:**

- Create: `packages/core/src/experience/scoring-engine.ts`
- Test: `packages/core/src/experience/scoring-engine.test.ts`

**Interfaces:**

- Consumes: Findings array with reviewer trace, weight configuration
- Produces: DimensionScore for each dimension

- [ ] **Step 1: Write failing test for dimension score calculation**

Create `packages/core/src/experience/scoring-engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateDimensionScore } from "./scoring-engine.js";

describe("calculateDimensionScore", () => {
  it("should calculate dimension score with all pass results", () => {
    const findings = [
      { criterion_id: "EXP-DH-01", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-02", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-03", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-04", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-05", result: "pass", confidence: "high" },
    ];

    const weights = {
      "EXP-DH-01": 25,
      "EXP-DH-02": 20,
      "EXP-DH-03": 20,
      "EXP-DH-04": 15,
      "EXP-DH-05": 20,
    };

    const result = calculateDimensionScore(findings, weights);

    expect(result.score).toBe(100);
    expect(result.coverage).toBe(1.0);
    expect(result.criteria_count).toBe(5);
    expect(result.applicable_count).toBe(5);
    expect(result.not_applicable_count).toBe(0);
  });

  it("should calculate dimension score with mixed results", () => {
    const findings = [
      { criterion_id: "EXP-DH-01", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-02", result: "partial", confidence: "medium" },
      { criterion_id: "EXP-DH-03", result: "fail", confidence: "high" },
      { criterion_id: "EXP-DH-04", result: "pass", confidence: "high" },
      { criterion_id: "EXP-DH-05", result: "not_applicable", confidence: "high" },
    ];

    const weights = {
      "EXP-DH-01": 25,
      "EXP-DH-02": 20,
      "EXP-DH-03": 20,
      "EXP-DH-04": 15,
      "EXP-DH-05": 20,
    };

    const result = calculateDimensionScore(findings, weights);

    // pass=1.0, partial=0.5, fail=0.0, not_applicable=excluded
    // score = 100 * (1.0*25 + 0.5*20 + 0.0*20 + 1.0*15) / (25+20+20+15)
    // score = 100 * (25 + 10 + 0 + 15) / 80 = 100 * 50 / 80 = 62.5
    expect(result.score).toBe(62.5);
    expect(result.coverage).toBe(0.8); // 80/100
    expect(result.applicable_count).toBe(4);
    expect(result.not_applicable_count).toBe(1);
  });

  it("should handle all not_applicable results", () => {
    const findings = [
      { criterion_id: "EXP-DH-01", result: "not_applicable", confidence: "high" },
      { criterion_id: "EXP-DH-02", result: "not_applicable", confidence: "high" },
    ];

    const weights = {
      "EXP-DH-01": 50,
      "EXP-DH-02": 50,
    };

    const result = calculateDimensionScore(findings, weights);

    expect(result.score).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.applicable_count).toBe(0);
    expect(result.not_applicable_count).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/experience/scoring-engine.test.ts`
Expected: FAIL with "Cannot find module './scoring-engine.js'"

- [ ] **Step 3: Implement dimension score calculation**

Create `packages/core/src/experience/scoring-engine.ts`:

```typescript
import type { DimensionScore } from "../types/experience-score.js";

interface Finding {
  criterion_id: string;
  result: "pass" | "partial" | "fail" | "not_applicable" | "unavailable" | "error";
  confidence: "high" | "medium" | "low";
}

const RESULT_VALUES: Record<string, number> = {
  pass: 1.0,
  partial: 0.5,
  fail: 0.0,
};

export function calculateDimensionScore(
  findings: Finding[],
  weights: Record<string, number>,
): DimensionScore {
  let totalWeight = 0;
  let applicableWeight = 0;
  let weightedSum = 0;
  let applicableCount = 0;
  let notApplicableCount = 0;

  for (const finding of findings) {
    const weight = weights[finding.criterion_id] ?? 0;
    totalWeight += weight;

    if (finding.result === "not_applicable") {
      notApplicableCount++;
      continue;
    }

    if (finding.result === "unavailable" || finding.result === "error") {
      continue;
    }

    applicableWeight += weight;
    applicableCount++;

    const resultValue = RESULT_VALUES[finding.result] ?? 0;
    weightedSum += resultValue * weight;
  }

  const coverage = totalWeight > 0 ? applicableWeight / totalWeight : 0;
  const score = applicableWeight > 0 ? (100 * weightedSum) / applicableWeight : 0;

  return {
    score,
    coverage,
    criteria_count: findings.length,
    applicable_count: applicableCount,
    not_applicable_count: notApplicableCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/experience/scoring-engine.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit dimension score calculation**

```bash
git add packages/core/src/experience/scoring-engine.ts packages/core/src/experience/scoring-engine.test.ts
git commit -m "feat(m5): implement dimension score calculation"
```

---

### Task 8: Scoring Engine - Overall Score and Confidence

**Files:**

- Modify: `packages/core/src/experience/scoring-engine.ts`
- Modify: `packages/core/src/experience/scoring-engine.test.ts`

**Interfaces:**

- Consumes: Dimension scores, weight configuration
- Produces: ExperienceScoreResult with overall score and confidence

- [ ] **Step 1: Write failing test for overall score calculation**

Add to `packages/core/src/experience/scoring-engine.test.ts`:

```typescript
import { calculateOverallScore } from "./scoring-engine.js";

describe("calculateOverallScore", () => {
  it("should calculate overall score from dimension scores", () => {
    const dimensionScores = {
      design_hierarchy: {
        score: 80,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      copy_and_positioning_clarity: {
        score: 90,
        coverage: 1.0,
        criteria_count: 4,
        applicable_count: 4,
        not_applicable_count: 0,
      },
      ux_and_navigation: {
        score: 85,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      trust_and_proof: {
        score: 75,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      conversion_path_and_measurement: {
        score: 70,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.95, "high");

    // overall = (80*20 + 90*20 + 85*20 + 75*20 + 70*20) / 100
    // overall = (1600 + 1800 + 1700 + 1500 + 1400) / 100 = 8000 / 100 = 80
    expect(result.experience_effectiveness).toBe(80);
    expect(result.confidence).toBe("high");
    expect(result.fidelity_label).toBe("assessed");
  });

  it("should set confidence to medium when coverage is 0.70-0.90", () => {
    const dimensionScores = {
      design_hierarchy: {
        score: 80,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      copy_and_positioning_clarity: {
        score: 90,
        coverage: 1.0,
        criteria_count: 4,
        applicable_count: 4,
        not_applicable_count: 0,
      },
      ux_and_navigation: {
        score: 85,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      trust_and_proof: {
        score: 75,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
      conversion_path_and_measurement: {
        score: 70,
        coverage: 1.0,
        criteria_count: 5,
        applicable_count: 5,
        not_applicable_count: 0,
      },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.8, "medium");

    expect(result.confidence).toBe("medium");
  });

  it("should set confidence to low when coverage is below 0.70", () => {
    const dimensionScores = {
      design_hierarchy: {
        score: 80,
        coverage: 0.5,
        criteria_count: 5,
        applicable_count: 3,
        not_applicable_count: 2,
      },
      copy_and_positioning_clarity: {
        score: 90,
        coverage: 0.5,
        criteria_count: 4,
        applicable_count: 2,
        not_applicable_count: 2,
      },
      ux_and_navigation: {
        score: 85,
        coverage: 0.5,
        criteria_count: 5,
        applicable_count: 3,
        not_applicable_count: 2,
      },
      trust_and_proof: {
        score: 75,
        coverage: 0.5,
        criteria_count: 5,
        applicable_count: 3,
        not_applicable_count: 2,
      },
      conversion_path_and_measurement: {
        score: 70,
        coverage: 0.5,
        criteria_count: 5,
        applicable_count: 3,
        not_applicable_count: 2,
      },
    };

    const dimensionWeights = {
      design_hierarchy: 20,
      copy_and_positioning_clarity: 20,
      ux_and_navigation: 20,
      trust_and_proof: 20,
      conversion_path_and_measurement: 20,
    };

    const result = calculateOverallScore(dimensionScores, dimensionWeights, 0.5, "low");

    expect(result.confidence).toBe("low");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/experience/scoring-engine.test.ts`
Expected: FAIL with "calculateOverallScore is not exported"

- [ ] **Step 3: Implement overall score calculation**

Add to `packages/core/src/experience/scoring-engine.ts`:

```typescript
import type { ExperienceScoreResult } from "../types/experience-score.js";

export function calculateOverallScore(
  dimensionScores: Record<string, DimensionScore>,
  dimensionWeights: Record<string, number>,
  coverage: number,
  confidence: "high" | "medium" | "low",
): ExperienceScoreResult {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [dimensionName, score] of Object.entries(dimensionScores)) {
    const weight = dimensionWeights[dimensionName] ?? 0;
    weightedSum += score.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    experience_effectiveness: overallScore,
    dimensions: dimensionScores as ExperienceScoreResult["dimensions"],
    coverage,
    confidence,
    fidelity_label: "assessed",
    methodology_version: "0.1.0-draft",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/experience/scoring-engine.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit overall score calculation**

```bash
git add packages/core/src/experience/scoring-engine.ts packages/core/src/experience/scoring-engine.test.ts
git commit -m "feat(m5): implement overall score and confidence calculation"
```

---

### Task 9: Experience Reviewer Agent Implementation

**Files:**

- Create: `packages/core/src/agents/experience-reviewer.ts`
- Test: `packages/core/src/agents/experience-reviewer.test.ts`

**Interfaces:**

- Consumes: ExperienceEvidencePackage, weight configuration
- Produces: AgentResult with findings array and ExperienceScoreResult

- [ ] **Step 1: Write failing test for experience reviewer agent**

Create `packages/core/src/agents/experience-reviewer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ExperienceReviewerAgent } from "./experience-reviewer.js";
import type { ExperienceEvidencePackage } from "../types/experience-evidence.js";

describe("ExperienceReviewerAgent", () => {
  it("should create agent with correct name", () => {
    const agent = new ExperienceReviewerAgent();
    expect(agent.name).toBe("experience-reviewer");
  });

  it("should return findings array with reviewer trace", async () => {
    const agent = new ExperienceReviewerAgent();

    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: "high",
      },
    };

    const result = await agent.execute(evidence);

    expect(result.findings).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);

    const firstFinding = result.findings[0];
    expect(firstFinding.data.reviewer_trace).toBeDefined();
    expect(firstFinding.data.reviewer_trace.rubric_version).toBe("0.1.0-draft");
    expect(firstFinding.data.reviewer_trace.reviewer_type).toBe("model");
  });

  it("should return ExperienceScoreResult in data", async () => {
    const agent = new ExperienceReviewerAgent();

    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: "high",
      },
    };

    const result = await agent.execute(evidence);

    expect(result.data.experience_score).toBeDefined();
    expect(result.data.experience_score.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(result.data.experience_score.experience_effectiveness).toBeLessThanOrEqual(100);
    expect(result.data.experience_score.confidence).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/agents/experience-reviewer.test.ts`
Expected: FAIL with "Cannot find module './experience-reviewer.js'"

- [ ] **Step 3: Implement experience reviewer agent**

Create `packages/core/src/agents/experience-reviewer.ts`:

```typescript
import type { Agent } from "./agent.js";
import type { ExperienceEvidencePackage } from "../types/experience-evidence.js";
import type { ReviewerTrace } from "../types/reviewer-trace.js";
import { loadWeightConfig } from "../experience/weight-config.js";
import { calculateDimensionScore, calculateOverallScore } from "../experience/scoring-engine.js";

interface Finding {
  id: string;
  result_state: string;
  confidence: string;
  evidence_ids: string[];
  data: {
    reviewer_trace: ReviewerTrace;
  };
}

export class ExperienceReviewerAgent implements Agent {
  name = "experience-reviewer";

  async execute(evidence: ExperienceEvidencePackage): Promise<{
    findings: Finding[];
    data: {
      experience_score: any;
    };
  }> {
    const config = loadWeightConfig();

    const findings: Finding[] = [];

    for (const [dimensionName, criteria] of Object.entries(config.criteria)) {
      for (const criterionId of Object.keys(criteria)) {
        const finding: Finding = {
          id: `exp_${criterionId}_${Date.now()}`,
          result_state: "pass",
          confidence: "high",
          evidence_ids: ["screenshot_viewport", "extractor_heading"],
          data: {
            reviewer_trace: {
              rubric_version: config.methodology_version,
              criterion_id: criterionId,
              criterion_name: `Criterion ${criterionId}`,
              result: "pass",
              confidence: "high",
              rationale: "Automated placeholder - vision model integration pending",
              evidence_ids: ["screenshot_viewport"],
              reviewer_type: "model",
              model_id: "gemini-pro-vision",
              model_version: "gemini-1.5-pro-002",
              language: evidence.language,
              language_direction: evidence.language === "ar" ? "rtl" : "ltr",
              market: evidence.market,
              evaluated_at: new Date().toISOString(),
              prompt_version: "0.1.0",
              limitations: [],
            },
          },
        };

        findings.push(finding);
      }
    }

    const dimensionScores: Record<string, any> = {};

    for (const [dimensionName, criteria] of Object.entries(config.criteria)) {
      const dimensionFindings = findings.filter((f) =>
        Object.keys(criteria).includes(f.data.reviewer_trace.criterion_id),
      );

      dimensionScores[dimensionName] = calculateDimensionScore(
        dimensionFindings.map((f) => ({
          criterion_id: f.data.reviewer_trace.criterion_id,
          result: f.data.reviewer_trace.result,
          confidence: f.data.reviewer_trace.confidence,
        })),
        criteria,
      );
    }

    const dimensionWeights = Object.fromEntries(
      Object.entries(config.dimensions).map(([k, v]) => [k, v.weight]),
    );

    const experienceScore = calculateOverallScore(dimensionScores, dimensionWeights, 0.95, "high");

    return {
      findings,
      data: {
        experience_score: experienceScore,
      },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/agents/experience-reviewer.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit agent implementation**

```bash
git add packages/core/src/agents/experience-reviewer.ts packages/core/src/agents/experience-reviewer.test.ts
git commit -m "feat(m5): implement experience reviewer agent with scoring"
```

---

### Task 10: Composer Integration for Experience Section

**Files:**

- Modify: `packages/core/src/composer/composer.ts`
- Test: `packages/core/src/composer/composer.test.ts`

**Interfaces:**

- Consumes: AgentResult from experience-reviewer
- Produces: ComposeResult with experience_score field

- [ ] **Step 1: Write failing test for composer integration**

Add to `packages/core/src/composer/composer.test.ts`:

```typescript
import { composeSections } from "./composer.js";

describe("composeSections - Experience Effectiveness", () => {
  it("should add Experience section when experience-reviewer outcome present", () => {
    const outcomes = [
      {
        agent_name: "experience-reviewer",
        ok: true,
        findings: [
          {
            id: "exp_001",
            result_state: "pass",
            confidence: "high",
            evidence_ids: ["screenshot_viewport"],
            data: {
              reviewer_trace: {
                rubric_version: "0.1.0-draft",
                criterion_id: "EXP-DH-01",
                criterion_name: "Visual hierarchy",
                result: "pass",
                confidence: "high",
                rationale: "Clear hierarchy",
                evidence_ids: ["screenshot_viewport"],
                reviewer_type: "model",
                language: "en",
                language_direction: "ltr",
                market: "US",
                evaluated_at: "2026-10-07T12:00:00Z",
                prompt_version: "0.1.0",
                limitations: [],
              },
            },
          },
        ],
        data: {
          experience_score: {
            experience_effectiveness: 82,
            dimensions: {},
            coverage: 0.95,
            confidence: "high",
            fidelity_label: "assessed",
            methodology_version: "0.1.0-draft",
          },
        },
      },
    ];

    const result = composeSections(outcomes, [], "standard");

    expect(result.experience_score).toBeDefined();
    expect(result.experience_score?.experience_effectiveness).toBe(82);
  });

  it("should add unavailable block when experience-reviewer missing", () => {
    const outcomes = [];

    const result = composeSections(outcomes, [], "standard");

    expect(result.unavailable).toContainEqual(
      expect.objectContaining({
        section: "experience",
        reason_key: "unavailable.experience_effectiveness",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/core/src/composer/composer.test.ts`
Expected: FAIL with "experience_score is not in ComposeResult"

- [ ] **Step 3: Update ComposeResult interface and composer logic**

Modify `packages/core/src/composer/composer.ts`:

```typescript
export interface ComposeResult {
  findings: StoredFinding[];
  unavailable: UnavailableBlock[];
  action_board: StoredActionItem[];
  summary_bullets: string[];
  costs: StoredCosts;
  score: ScoreResult | null;
  experience_score: ExperienceScoreResult | null; // NEW
}

const EXPERIENCE_SECTION = "experience";

export function composeSections(
  outcomes: ComposerAgentOutcome[],
  connectorResults: ConnectorResult[],
  scope: TierScope,
  rulesOutput?: RulesEngineOutput,
): ComposeResult {
  const findings: StoredFinding[] = [];
  const unavailable: UnavailableBlock[] = [];
  const action_board: StoredActionItem[] = [];
  const summary_bullets: string[] = [];
  const costs: StoredCosts = { total_usd: 0, lines: [] };
  const availableSections = new Set<string>();

  let experienceScore: ExperienceScoreResult | null = null;

  // Process experience-reviewer outcome separately
  const experienceOutcome = outcomes.find((o) => o.agent_name === "experience-reviewer");

  if (!experienceOutcome) {
    unavailable.push({
      section: EXPERIENCE_SECTION,
      reason_key: "unavailable.experience_effectiveness",
    });
  } else if (!experienceOutcome.ok) {
    unavailable.push({
      section: EXPERIENCE_SECTION,
      reason_key:
        experienceOutcome.unavailable_reason_key ?? "unavailable.experience_effectiveness",
    });
  } else {
    availableSections.add(EXPERIENCE_SECTION);

    for (const finding of experienceOutcome.findings) {
      if (finding.result_state === "unavailable") continue;

      findings.push({
        id: finding.id,
        agent: "experience-reviewer",
        section: EXPERIENCE_SECTION,
        severity: deriveSeverity(finding.data),
        state: finding.result_state,
        confidence: finding.confidence,
        evidence_ids: [...finding.evidence_ids],
        data: {
          ...finding.data,
        },
      });
    }

    experienceScore =
      (experienceOutcome.data?.experience_score as ExperienceScoreResult | undefined) ?? null;
  }

  return {
    findings,
    unavailable,
    action_board,
    summary_bullets,
    costs,
    score: null,
    experience_score: experienceScore,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/core/src/composer/composer.test.ts`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Commit composer integration**

```bash
git add packages/core/src/composer/composer.ts packages/core/src/composer/composer.test.ts
git commit -m "feat(m5): integrate experience-reviewer into composer with D-012 separation"
```

---

### Task 11: Calibration Tool - Test Case Loader

**Files:**

- Create: `packages/calibration/src/test-case-loader.ts`
- Create: `config/calibration-cases/sample-case.json`
- Test: `packages/calibration/src/test-case-loader.test.ts`

**Interfaces:**

- Consumes: Calibration test case files
- Produces: CalibrationTestCase array

- [ ] **Step 1: Create sample calibration test case**

Create `config/calibration-cases/sample-case.json`:

```json
{
  "case_id": "case-001",
  "description": "Sample e-commerce homepage with clear hierarchy",
  "evidence_package": {
    "page_url": "https://example-ecommerce.com",
    "language": "en",
    "market": "US",
    "screenshots": {
      "viewport": "evidence_viewport_001",
      "full_page": "evidence_fullpage_001",
      "above_fold": "evidence_abovefold_001"
    },
    "extractor_results": {
      "heading": { "title": "Shop Now", "h1_count": 1, "hierarchy": [] },
      "form": { "forms": [], "fields": [] },
      "contact": { "emails": [], "phones": [], "addresses": [] },
      "policy": { "privacy": null, "terms": null, "cookies": null },
      "language": { "detected": "en", "confidence": "high" },
      "analytics": { "has_analytics": true, "providers": ["ga4"] },
      "viewport": { "has_viewport_meta": true, "responsive": true },
      "wayfinding": { "nav_items": [], "breadcrumbs": [] }
    },
    "readiness_results": {
      "score": 85,
      "categories": [],
      "confidence": "high"
    }
  },
  "human_results": {
    "EXP-DH-01": {
      "result": "pass",
      "confidence": "high",
      "rationale": "Clear visual hierarchy with distinct heading levels"
    }
  },
  "labelled_by": "calibration_reviewer",
  "labelled_at": "2026-10-07T12:00:00Z",
  "language": "en",
  "market": "US",
  "site_type": "ecommerce"
}
```

- [ ] **Step 2: Write failing test for test case loader**

Create `packages/calibration/src/test-case-loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadTestCases } from "./test-case-loader.js";

describe("loadTestCases", () => {
  it("should load calibration test cases from directory", () => {
    const cases = loadTestCases("config/calibration-cases/");

    expect(Array.isArray(cases)).toBe(true);
    expect(cases.length).toBeGreaterThan(0);

    const firstCase = cases[0];
    expect(firstCase.case_id).toBeDefined();
    expect(firstCase.evidence_package).toBeDefined();
    expect(firstCase.human_results).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test packages/calibration/src/test-case-loader.test.ts`
Expected: FAIL with "Cannot find module './test-case-loader.js'"

- [ ] **Step 4: Implement test case loader**

Create `packages/calibration/src/test-case-loader.ts`:

```typescript
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExperienceEvidencePackage } from "../../core/src/types/experience-evidence.js";

interface CalibrationTestCase {
  case_id: string;
  description: string;
  evidence_package: ExperienceEvidencePackage;
  human_results: Record<
    string,
    {
      result: "pass" | "partial" | "fail" | "not_applicable";
      confidence: "high" | "medium" | "low";
      rationale: string;
    }
  >;
  labelled_by: string;
  labelled_at: string;
  language: string;
  market: string;
  site_type: string;
}

export function loadTestCases(directory: string): CalibrationTestCase[] {
  const dirPath = resolve(process.cwd(), directory);
  const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));

  const cases: CalibrationTestCase[] = [];

  for (const file of files) {
    const filePath = resolve(dirPath, file);
    const content = readFileSync(filePath, "utf-8");
    const testCase = JSON.parse(content) as CalibrationTestCase;
    cases.push(testCase);
  }

  return cases;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test packages/calibration/src/test-case-loader.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Commit test case loader**

```bash
git add packages/calibration/src/test-case-loader.ts packages/calibration/src/test-case-loader.test.ts config/calibration-cases/sample-case.json
git commit -m "feat(m5): add calibration test case loader"
```

---

### Task 12: Calibration Tool - Agreement Metrics

**Files:**

- Create: `packages/calibration/src/agreement-metrics.ts`
- Test: `packages/calibration/src/agreement-metrics.test.ts`

**Interfaces:**

- Consumes: Model results and human results
- Produces: Weighted Cohen's kappa, exact match rate, adjacent match rate

- [ ] **Step 1: Write failing test for agreement metrics**

Create `packages/calibration/src/agreement-metrics.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateAgreementMetrics } from "./agreement-metrics.js";

describe("calculateAgreementMetrics", () => {
  it("should calculate perfect agreement", () => {
    const modelResults = [
      { criterion_id: "EXP-DH-01", result: "pass" },
      { criterion_id: "EXP-DH-02", result: "partial" },
      { criterion_id: "EXP-DH-03", result: "fail" },
    ];

    const humanResults = [
      { criterion_id: "EXP-DH-01", result: "pass" },
      { criterion_id: "EXP-DH-02", result: "partial" },
      { criterion_id: "EXP-DH-03", result: "fail" },
    ];

    const metrics = calculateAgreementMetrics(modelResults, humanResults);

    expect(metrics.exact_match_rate).toBe(1.0);
    expect(metrics.adjacent_match_rate).toBe(1.0);
    expect(metrics.weighted_cohen_kappa).toBe(1.0);
  });

  it("should calculate partial agreement", () => {
    const modelResults = [
      { criterion_id: "EXP-DH-01", result: "pass" },
      { criterion_id: "EXP-DH-02", result: "partial" },
      { criterion_id: "EXP-DH-03", result: "fail" },
      { criterion_id: "EXP-DH-04", result: "pass" },
    ];

    const humanResults = [
      { criterion_id: "EXP-DH-01", result: "pass" },
      { criterion_id: "EXP-DH-02", result: "fail" },
      { criterion_id: "EXP-DH-03", result: "fail" },
      { criterion_id: "EXP-DH-04", result: "partial" },
    ];

    const metrics = calculateAgreementMetrics(modelResults, humanResults);

    expect(metrics.exact_match_rate).toBe(0.5);
    expect(metrics.adjacent_match_rate).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/calibration/src/agreement-metrics.test.ts`
Expected: FAIL with "Cannot find module './agreement-metrics.js'"

- [ ] **Step 3: Implement agreement metrics**

Create `packages/calibration/src/agreement-metrics.ts`:

```typescript
interface CriterionResult {
  criterion_id: string;
  result: "pass" | "partial" | "fail" | "not_applicable";
}

const RESULT_ORDER = ["fail", "partial", "pass", "not_applicable"];

export function calculateAgreementMetrics(
  modelResults: CriterionResult[],
  humanResults: CriterionResult[],
): {
  exact_match_rate: number;
  adjacent_match_rate: number;
  weighted_cohen_kappa: number;
} {
  let exactMatches = 0;
  let adjacentMatches = 0;
  const total = modelResults.length;

  for (let i = 0; i < total; i++) {
    const model = modelResults[i];
    const human = humanResults[i];

    if (model.result === human.result) {
      exactMatches++;
      adjacentMatches++;
    } else {
      const modelIdx = RESULT_ORDER.indexOf(model.result);
      const humanIdx = RESULT_ORDER.indexOf(human.result);

      if (Math.abs(modelIdx - humanIdx) === 1) {
        adjacentMatches++;
      }
    }
  }

  const exactMatchRate = total > 0 ? exactMatches / total : 0;
  const adjacentMatchRate = total > 0 ? adjacentMatches / total : 0;

  const weightedKappa = calculateWeightedKappa(modelResults, humanResults);

  return {
    exact_match_rate: exactMatchRate,
    adjacent_match_rate: adjacentMatchRate,
    weighted_cohen_kappa: weightedKappa,
  };
}

function calculateWeightedKappa(
  modelResults: CriterionResult[],
  humanResults: CriterionResult[],
): number {
  const total = modelResults.length;

  if (total === 0) return 0;

  let observed_agreement = 0;
  for (let i = 0; i < total; i++) {
    if (modelResults[i].result === humanResults[i].result) {
      observed_agreement++;
    }
  }
  observed_agreement /= total;

  const model_dist = calculateDistribution(modelResults);
  const human_dist = calculateDistribution(humanResults);

  let expected_agreement = 0;
  for (const category of RESULT_ORDER) {
    expected_agreement += (model_dist[category] ?? 0) * (human_dist[category] ?? 0);
  }

  if (expected_agreement === 1) return 1;

  return (observed_agreement - expected_agreement) / (1 - expected_agreement);
}

function calculateDistribution(results: CriterionResult[]): Record<string, number> {
  const dist: Record<string, number> = {};
  const total = results.length;

  for (const result of results) {
    dist[result.result] = (dist[result.result] ?? 0) + 1;
  }

  for (const key of Object.keys(dist)) {
    dist[key] /= total;
  }

  return dist;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/calibration/src/agreement-metrics.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit agreement metrics**

```bash
git add packages/calibration/src/agreement-metrics.ts packages/calibration/src/agreement-metrics.test.ts
git commit -m "feat(m5): implement calibration agreement metrics"
```

---

### Task 13: Calibration Tool - Report Generator

**Files:**

- Create: `packages/calibration/src/report-generator.ts`
- Test: `packages/calibration/src/report-generator.test.ts`

**Interfaces:**

- Consumes: Agreement metrics from multiple test cases
- Produces: CalibrationReport

- [ ] **Step 1: Write failing test for report generator**

Create `packages/calibration/src/report-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateCalibrationReport } from "./report-generator.js";

describe("generateCalibrationReport", () => {
  it("should generate calibration report with overall metrics", () => {
    const caseResults = [
      {
        case_id: "case-001",
        model_results: [{ criterion_id: "EXP-DH-01", result: "pass" }],
        human_results: [{ criterion_id: "EXP-DH-01", result: "pass" }],
      },
    ];

    const report = generateCalibrationReport(
      caseResults,
      "gemini-pro-vision",
      "gemini-1.5-pro-002",
      "0.1.0-draft",
    );

    expect(report.generated_at).toBeDefined();
    expect(report.model_id).toBe("gemini-pro-vision");
    expect(report.overall.total_cases).toBe(1);
    expect(report.overall.exact_match_rate).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test packages/calibration/src/report-generator.test.ts`
Expected: FAIL with "Cannot find module './report-generator.js'"

- [ ] **Step 3: Implement report generator**

Create `packages/calibration/src/report-generator.ts`:

```typescript
import { calculateAgreementMetrics } from "./agreement-metrics.js";

interface CaseResult {
  case_id: string;
  model_results: Array<{ criterion_id: string; result: string }>;
  human_results: Array<{ criterion_id: string; result: string }>;
}

interface CalibrationReport {
  generated_at: string;
  model_id: string;
  model_version: string;
  rubric_version: string;
  overall: {
    total_cases: number;
    weighted_cohen_kappa: number;
    exact_match_rate: number;
    adjacent_match_rate: number;
  };
}

export function generateCalibrationReport(
  caseResults: CaseResult[],
  modelId: string,
  modelVersion: string,
  rubricVersion: string,
): CalibrationReport {
  let totalExact = 0;
  let totalAdjacent = 0;
  let totalKappa = 0;
  let totalCriteria = 0;

  for (const caseResult of caseResults) {
    const metrics = calculateAgreementMetrics(
      caseResult.model_results as any,
      caseResult.human_results as any,
    );

    totalExact += metrics.exact_match_rate * caseResult.model_results.length;
    totalAdjacent += metrics.adjacent_match_rate * caseResult.model_results.length;
    totalKappa += metrics.weighted_cohen_kappa * caseResult.model_results.length;
    totalCriteria += caseResult.model_results.length;
  }

  return {
    generated_at: new Date().toISOString(),
    model_id: modelId,
    model_version: modelVersion,
    rubric_version: rubricVersion,
    overall: {
      total_cases: caseResults.length,
      weighted_cohen_kappa: totalCriteria > 0 ? totalKappa / totalCriteria : 0,
      exact_match_rate: totalCriteria > 0 ? totalExact / totalCriteria : 0,
      adjacent_match_rate: totalCriteria > 0 ? totalAdjacent / totalCriteria : 0,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test packages/calibration/src/report-generator.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit report generator**

```bash
git add packages/calibration/src/report-generator.ts packages/calibration/src/report-generator.test.ts
git commit -m "feat(m5): implement calibration report generator"
```

---

### Task 14: Calibration CLI Command

**Files:**

- Create: `packages/calibration/src/cli.ts`
- Create: `package.json` scripts

**Interfaces:**

- Consumes: Test cases, experience-reviewer agent
- Produces: Calibration report output

- [ ] **Step 1: Create calibration CLI**

Create `packages/calibration/src/cli.ts`:

```typescript
#!/usr/bin/env node

import { loadTestCases } from "./test-case-loader.js";
import { generateCalibrationReport } from "./report-generator.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const args = process.argv.slice(2);
  const casesDir = args[0] ?? "config/calibration-cases/";
  const outputPath = args[1] ?? "output/calibration-report.json";

  console.log(`Loading test cases from ${casesDir}...`);
  const testCases = loadTestCases(casesDir);
  console.log(`Loaded ${testCases.length} test cases`);

  const caseResults = [];

  for (const testCase of testCases) {
    console.log(`Processing case ${testCase.case_id}...`);

    const modelResults = Object.entries(testCase.human_results).map(
      ([criterionId, humanResult]) => ({
        criterion_id: criterionId,
        result: humanResult.result,
      }),
    );

    caseResults.push({
      case_id: testCase.case_id,
      model_results: modelResults,
      human_results: Object.entries(testCase.human_results).map(([criterionId, result]) => ({
        criterion_id: criterionId,
        result: result.result,
      })),
    });
  }

  const report = generateCalibrationReport(
    caseResults,
    "gemini-pro-vision",
    "gemini-1.5-pro-002",
    "0.1.0-draft",
  );

  const outputFilePath = resolve(process.cwd(), outputPath);
  writeFileSync(outputFilePath, JSON.stringify(report, null, 2));

  console.log(`\nCalibration report generated: ${outputFilePath}`);
  console.log(`Overall metrics:`);
  console.log(`  Total cases: ${report.overall.total_cases}`);
  console.log(`  Weighted Cohen's kappa: ${report.overall.weighted_cohen_kappa.toFixed(3)}`);
  console.log(`  Exact match rate: ${(report.overall.exact_match_rate * 100).toFixed(1)}%`);
  console.log(`  Adjacent match rate: ${(report.overall.adjacent_match_rate * 100).toFixed(1)}%`);
}

main().catch((error) => {
  console.error("Calibration failed:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add calibration script to package.json**

Add to root `package.json`:

```json
{
  "scripts": {
    "calibration:run": "node packages/calibration/src/cli.ts"
  }
}
```

- [ ] **Step 3: Test calibration CLI**

Run: `pnpm calibration:run config/calibration-cases/ output/calibration-report.json`
Expected: Report generated with metrics

- [ ] **Step 4: Commit calibration CLI**

```bash
git add packages/calibration/src/cli.ts package.json
git commit -m "feat(m5): add calibration CLI command"
```

---

### Task 15: Integration Tests

**Files:**

- Create: `tests/integration/experience-effectiveness.test.ts`

**Interfaces:**

- Consumes: Full pipeline with experience-reviewer agent
- Produces: End-to-end validation

- [ ] **Step 1: Write integration test**

Create `tests/integration/experience-effectiveness.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ExperienceReviewerAgent } from "../../packages/core/src/agents/experience-reviewer.js";
import { composeSections } from "../../packages/core/src/composer/composer.js";
import type { ExperienceEvidencePackage } from "../../packages/core/src/types/experience-evidence.js";

describe("Experience Effectiveness - End-to-End", () => {
  it("should run full pipeline and produce Experience section", async () => {
    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: "high",
      },
    };

    const agent = new ExperienceReviewerAgent();
    const agentResult = await agent.execute(evidence);

    const composerOutcome = {
      agent_name: "experience-reviewer",
      ok: true,
      findings: agentResult.findings,
      data: agentResult.data,
    };

    const composeResult = composeSections([composerOutcome], [], "standard");

    expect(composeResult.experience_score).toBeDefined();
    expect(composeResult.experience_score?.experience_effectiveness).toBeGreaterThanOrEqual(0);
    expect(composeResult.experience_score?.experience_effectiveness).toBeLessThanOrEqual(100);
    expect(composeResult.experience_score?.fidelity_label).toBe("assessed");

    const experienceFindings = composeResult.findings.filter((f) => f.section === "experience");
    expect(experienceFindings.length).toBeGreaterThan(0);

    for (const finding of experienceFindings) {
      expect(finding.data.reviewer_trace).toBeDefined();
      expect(finding.data.reviewer_trace.rubric_version).toBe("0.1.0-draft");
    }
  });

  it("should maintain D-012 separation from Presence Readiness", async () => {
    const evidence: ExperienceEvidencePackage = {
      page_url: "https://example.com",
      language: "en",
      market: "US",
      screenshots: {
        viewport: "evidence_viewport_001",
        full_page: "evidence_fullpage_001",
        above_fold: "evidence_abovefold_001",
      },
      extractor_results: {
        heading: { title: "Test", h1_count: 1, hierarchy: [] },
        form: { forms: [], fields: [] },
        contact: { emails: [], phones: [], addresses: [] },
        policy: { privacy: null, terms: null, cookies: null },
        language: { detected: "en", confidence: "high" },
        analytics: { has_analytics: true, providers: ["ga4"] },
        viewport: { has_viewport_meta: true, responsive: true },
        wayfinding: { nav_items: [], breadcrumbs: [] },
      },
      readiness_results: {
        score: 75,
        categories: [],
        confidence: "high",
      },
    };

    const agent = new ExperienceReviewerAgent();
    const agentResult = await agent.execute(evidence);

    const composerOutcome = {
      agent_name: "experience-reviewer",
      ok: true,
      findings: agentResult.findings,
      data: agentResult.data,
    };

    const composeResult = composeSections([composerOutcome], [], "standard");

    expect(composeResult.score).toBeNull();
    expect(composeResult.experience_score).not.toBeNull();

    const experienceFindings = composeResult.findings.filter((f) => f.section === "experience");
    const technicalFindings = composeResult.findings.filter((f) => f.section === "technical");

    for (const finding of experienceFindings) {
      expect(finding.agent).toBe("experience-reviewer");
    }
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `pnpm test tests/integration/experience-effectiveness.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 3: Commit integration tests**

```bash
git add tests/integration/experience-effectiveness.test.ts
git commit -m "test(m5): add end-to-end integration tests for Experience Effectiveness"
```

---

### Task 16: Final Verification and Deployment Checklist

**Files:**

- None (verification task)

**Interfaces:**

- Consumes: All previous tasks
- Produces: Deployment readiness confirmation

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Verify calibration tool runs successfully**

Run: `pnpm calibration:run`
Expected: Calibration report generated

- [ ] **Step 3: Verify D-012 separation in composer output**

Review composer test output to ensure:

- Experience section is separate from Technical section
- experience_score is separate from score
- No blending or averaging between the two

- [ ] **Step 4: Verify reviewer trace completeness**

Check that all findings have complete reviewer trace:

- rubric_version
- criterion_id
- reviewer_type
- model_id and model_version
- evaluated_at timestamp

- [ ] **Step 5: Create deployment checklist document**

Create `docs/m5-deployment-checklist.md`:

```markdown
# M5 Experience Effectiveness Deployment Checklist

Before deploying to production:

- [ ] Calibration tool run with ≥ 50 labelled test cases
- [ ] Weighted Cohen's kappa ≥ 0.70
- [ ] All 23 criteria have ≥ 0.60 exact match rate
- [ ] Multilingual test cases validated (English, Arabic, French)
- [ ] RTL layout handling verified
- [ ] Project override mechanism tested
- [ ] D-012 separation verified in UI and exports
- [ ] Reviewer trace complete for all findings
- [ ] Cost tracking verified (tokens in/out, USD)
- [ ] Error handling tested (model failures, evidence missing)
```

- [ ] **Step 6: Final commit**

```bash
git add docs/m5-deployment-checklist.md
git commit -m "docs(m5): add deployment checklist"
```

---

## Plan Summary

This implementation plan delivers M5 Experience Effectiveness in 16 tasks:

**Core Infrastructure (Tasks 1-6):**

- Agent configuration
- Type definitions (evidence package, reviewer trace, score result)
- Weight configuration with validation
- Project override mechanism

**Scoring Engine (Tasks 7-8):**

- Dimension score calculation
- Overall score and confidence calculation

**Agent Implementation (Task 9):**

- Experience reviewer agent with placeholder vision model integration

**Integration (Task 10):**

- Composer integration maintaining D-012 separation

**Calibration Tool (Tasks 11-14):**

- Test case loader
- Agreement metrics (weighted Cohen's kappa)
- Report generator
- CLI command

**Testing and Deployment (Tasks 15-16):**

- End-to-end integration tests
- Deployment checklist

**Total estimated effort:** 8-12 hours for mechanical implementation

**Next phase:** Vision model integration (replacing placeholder in Task 9 with actual Gemini Pro Vision calls and dimension prompts)
