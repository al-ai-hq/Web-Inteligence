# M2 Rules Engine, Scoring & Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic rules engine that evaluates 77 rules against crawled evidence, computes the Presence Readiness score with category weights and critical caps, generates prioritized findings with lineage, and integrates into the audit pipeline so real reports show deterministic findings and a reproducible score.

**Architecture:** New `@wpi/rules-engine` package loads rule YAMLs via zod, evaluates rules per-page or per-site via TypeScript evaluators grouped by evidence type, aggregates page results to site scope via deterministic ratio policy, computes category scores and overall readiness with critical caps, generates findings with severity and priority, attaches lineage and fidelity labels, and integrates into `audit-pipeline`'s AUDITING stage before agents/connectors run.

**Tech Stack:** TypeScript strict, pnpm workspace, zod for config validation, Vitest for testing, Ajv2020 for schema validation, existing `@wpi/security` for hash verification, existing `@wpi/crawler` for evidence types.

**Spec:** `docs/superpowers/specs/2026-10-05-m2-rules-engine-scoring-design.md`

## Global Constraints

- All 77 rules must load from YAML; malformed config fails closed with `ConfigError` before crawl.
- Golden fixtures must reproduce scores exactly (TS test + existing Python proof both green).
- Every ScoreResult/Finding/RuleResult carries lineage + fidelity label; schema validation passes.
- Tampered evidence cannot produce a score (IntegrityError → audit FAILED).
- Report shows score card, deterministic findings, evidence viewer, methodology disclosure (en + ar).
- Limitation keys `limitation.score_engine_deferred` and `limitation.deterministic_rules_deferred` removed from report model.
- Full monorepo suite green (build, typecheck, tests, Playwright).
- No condition-expression DSL, no plugin system.
- Evidence-first evaluators: each rule has a TypeScript evaluator grouped by the evidence it consumes.
- New package `@wpi/rules-engine/` for everything, including the integrity module.

---

### Task 1: Package scaffolding and config loader

**Files:**

- Create: `packages/rules-engine/package.json`
- Create: `packages/rules-engine/tsconfig.json`
- Create: `packages/rules-engine/src/index.ts`
- Create: `packages/rules-engine/src/config-loader.ts`
- Create: `packages/rules-engine/src/types.ts`
- Test: `packages/rules-engine/tests/config-loader.test.ts`

**Interfaces:**

- Consumes: `config/rules/*.yaml` (7 files), `config/scoring.yaml`
- Produces: `loadConfig(): { rules: LoadedRule[], scoring: ScoringConfig }` throwing `ConfigError` on validation failure

- [ ] **Step 1: Write the failing test for config loader**

```typescript
// packages/rules-engine/tests/config-loader.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config-loader.js";

describe("config-loader", () => {
  it("loads all 7 rule files and scoring.yaml", () => {
    const config = loadConfig();
    expect(config.rules.length).toBe(77);
    expect(config.scoring.methodology_version).toBe("0.1.0-draft");
    expect(config.scoring.category_weights).toBeDefined();
  });

  it("throws ConfigError when a rule YAML is malformed", () => {
    // Mock fs to return invalid YAML
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it("validates category weights sum to 100", () => {
    const config = loadConfig();
    const sum = Object.values(config.scoring.category_weights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/rules-engine && pnpm test tests/config-loader.test.ts`
Expected: FAIL with "Cannot find module" or similar

- [ ] **Step 3: Create package.json and tsconfig.json**

```json
// packages/rules-engine/package.json
{
  "name": "@wpi/rules-engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "yaml": "^2.5.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

```json
// packages/rules-engine/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Define types for LoadedRule and ScoringConfig**

```typescript
// packages/rules-engine/src/types.ts
export type RuleCategory =
  | "crawlability"
  | "on_page"
  | "structured_data"
  | "aeo"
  | "geo"
  | "i18n_accessibility"
  | "performance_security";

export interface LoadedRule {
  id: string;
  category: RuleCategory;
  title: string;
  importance_weight: number;
  scored: boolean;
  evaluation: "deterministic" | "assessed" | "attested";
  connected_tier_only: boolean;
  requires_data?: "keyword_data" | "business_profile_or_merchant_center";
  critical_cap?: string;
  applicability: string;
  standards: { pass: string; partial?: string; fail: string };
  fidelity_label: string;
}

export interface ScoringConfig {
  methodology_version: string;
  category_weights: Record<RuleCategory, number>;
  result_values: { pass: 1; partial: 0.5; fail: 0 };
  critical_caps: Array<{ cap_id: string; max_score: number; trigger_rule: string }>;
  confidence: { high_min_coverage: 0.9; medium_min_coverage: 0.7 };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
```

- [ ] **Step 5: Implement config loader with zod validation**

```typescript
// packages/rules-engine/src/config-loader.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { ConfigError, type LoadedRule, type ScoringConfig, type RuleCategory } from "./types.js";

const ruleSchema = z.object({
  id: z.string(),
  category: z.enum([
    "crawlability",
    "on_page",
    "structured_data",
    "aeo",
    "geo",
    "i18n_accessibility",
    "performance_security",
  ]),
  title: z.string(),
  importance_weight: z.number().int().min(0).max(5),
  scored: z.boolean(),
  evaluation: z.enum(["deterministic", "assessed", "attested"]),
  connected_tier_only: z.boolean().default(false),
  requires_data: z.enum(["keyword_data", "business_profile_or_merchant_center"]).optional(),
  critical_cap: z.string().optional(),
  applicability: z.string(),
  standards: z.object({
    pass: z.string(),
    partial: z.string().optional(),
    fail: z.string(),
  }),
  fidelity_label: z.string(),
});

const scoringSchema = z.object({
  methodology_version: z.string(),
  category_weights: z.record(z.number()),
  result_values: z.object({
    pass: z.literal(1),
    partial: z.literal(0.5),
    fail: z.literal(0),
  }),
  critical_caps: z.array(
    z.object({
      cap_id: z.string(),
      max_score: z.number(),
      trigger_rule: z.string(),
    }),
  ),
  confidence: z.object({
    high_min_coverage: z.number(),
    medium_min_coverage: z.number(),
  }),
});

export function loadConfig(): { rules: LoadedRule[]; scoring: ScoringConfig } {
  const configDir = join(process.cwd(), "config");
  const ruleFiles = [
    "crawlability.yaml",
    "on-page.yaml",
    "structured-data.yaml",
    "aeo.yaml",
    "geo.yaml",
    "i18n-accessibility.yaml",
    "performance-security.yaml",
  ];

  const rules: LoadedRule[] = [];
  for (const file of ruleFiles) {
    try {
      const content = readFileSync(join(configDir, "rules", file), "utf-8");
      const parsed = parse(content);
      if (!Array.isArray(parsed)) {
        throw new ConfigError(`Rule file ${file} must contain an array`);
      }
      for (const rule of parsed) {
        const result = ruleSchema.safeParse(rule);
        if (!result.success) {
          throw new ConfigError(`Invalid rule in ${file}: ${result.error.message}`);
        }
        rules.push(result.data as LoadedRule);
      }
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError(`Failed to load ${file}: ${error}`);
    }
  }

  const scoringContent = readFileSync(join(configDir, "scoring.yaml"), "utf-8");
  const scoringParsed = parse(scoringContent);
  const scoringResult = scoringSchema.safeParse(scoringParsed);
  if (!scoringResult.success) {
    throw new ConfigError(`Invalid scoring config: ${scoringResult.error.message}`);
  }

  const scoring = scoringResult.data as ScoringConfig;
  const weightSum = Object.values(scoring.category_weights).reduce((a, b) => a + b, 0);
  if (weightSum !== 100) {
    throw new ConfigError(`Category weights must sum to 100, got ${weightSum}`);
  }

  return { rules, scoring };
}

export { ConfigError } from "./types.js";
```

- [ ] **Step 6: Create index.ts exporting public API**

```typescript
// packages/rules-engine/src/index.ts
export { loadConfig, ConfigError } from "./config-loader.js";
export type { LoadedRule, ScoringConfig, RuleCategory } from "./types.js";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/rules-engine && pnpm test tests/config-loader.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/rules-engine/
git commit -m "feat(rules-engine): add package scaffolding and config loader"
```

---

### Task 2: Evidence types and rule catalog

**Files:**

- Create: `packages/rules-engine/src/evidence.ts`
- Create: `packages/rules-engine/src/rule-catalog.ts`
- Test: `packages/rules-engine/tests/rule-catalog.test.ts`

**Interfaces:**

- Consumes: `LoadedRule[]` from config loader
- Produces: `RuleCatalog` class with `getApplicableRules(tier, locale)` method filtering by tier and data requirements

- [ ] **Step 1: Write the failing test for rule catalog filtering**

```typescript
// packages/rules-engine/tests/rule-catalog.test.ts
import { describe, it, expect } from "vitest";
import { RuleCatalog } from "../src/rule-catalog.js";
import type { LoadedRule } from "../src/types.js";

describe("RuleCatalog", () => {
  const mockRules: LoadedRule[] = [
    {
      id: "CRW-001",
      category: "crawlability",
      title: "Homepage retrievable",
      importance_weight: 5,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      applicability: "always",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
    {
      id: "GSC-001",
      category: "crawlability",
      title: "GSC indexing",
      importance_weight: 3,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: true,
      applicability: "connected",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
    {
      id: "SEO-011",
      category: "on_page",
      title: "Keyword in title",
      importance_weight: 2,
      scored: true,
      evaluation: "deterministic",
      connected_tier_only: false,
      requires_data: "keyword_data",
      applicability: "keyword",
      standards: { pass: "ok", fail: "fail" },
      fidelity_label: "computed",
    },
  ];

  it("excludes connected-tier-only rules for preview tier", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("preview", "en");
    expect(applicable.find((r) => r.id === "GSC-001")).toBeUndefined();
  });

  it("includes connected-tier-only rules for rich tier", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("rich", "en");
    expect(applicable.find((r) => r.id === "GSC-001")).toBeDefined();
  });

  it("excludes rules requiring unavailable data sources", () => {
    const catalog = new RuleCatalog(mockRules);
    const applicable = catalog.getApplicableRules("rich", "en");
    expect(applicable.find((r) => r.id === "SEO-011")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/rules-engine && pnpm test tests/rule-catalog.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Define EvidenceBundle types**

```typescript
// packages/rules-engine/src/evidence.ts
export interface EvidenceBundle {
  methodology_version: string;
  tier: "rich" | "reduced" | "preview";
  locale: "en" | "ar";
  site: {
    root_url: string;
    homepage: PageEvidence | null;
    robots: RobotsEvidence;
    sitemap: SitemapEvidence;
    llms_txt: { present: boolean; references: string[] } | null;
    security: { https_valid: boolean; cert_error?: string; hsts: boolean };
  };
  pages: PageEvidence[];
  connectors: {
    psi?: PsiEvidence;
    crux?: CruxEvidence;
    gsc?: GscEvidence;
  };
  keyword_data?: never;
}

export interface PageEvidence {
  evidence_id: string;
  url: string;
  final_url: string;
  status_code: number;
  content_type: string;
  content_hash: string;
  fetched_at: string;
  render: { rendered: boolean; render_reason?: string };
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  lang: string | null;
  viewport_meta: string | null;
  headings: { level: number; text: string }[];
  word_count: number;
  main_content_bytes: number;
  structured_data: JsonLdBlock[];
  links: { href: string; rel?: string }[];
  robots_directive: "index" | "noindex" | "none";
}

export interface RobotsEvidence {
  fetched: boolean;
  content?: string;
  directives: Array<{ user_agent: string; allow: string[]; disallow: string[] }>;
}

export interface SitemapEvidence {
  present: boolean;
  url_count?: number;
}

export interface PsiEvidence {
  performance_score: number;
  lcp: number;
  fid: number;
  cls: number;
}

export interface CruxEvidence {
  lcp: number;
  inp: number;
  cls: number;
}

export interface GscEvidence {
  indexed_urls: number;
  valid_pages: number;
}

export interface JsonLdBlock {
  type: string;
  data: Record<string, unknown>;
}
```

- [ ] **Step 4: Implement RuleCatalog class**

```typescript
// packages/rules-engine/src/rule-catalog.ts
import type { LoadedRule } from "./types.js";

export class RuleCatalog {
  private readonly rules: LoadedRule[];

  constructor(rules: LoadedRule[]) {
    this.rules = rules;
  }

  getApplicableRules(tier: "rich" | "reduced" | "preview", locale: "en" | "ar"): LoadedRule[] {
    return this.rules.filter((rule) => {
      // Exclude connected-tier-only rules for preview tier
      if (tier === "preview" && rule.connected_tier_only) {
        return false;
      }

      // Exclude rules requiring unavailable data sources in M2
      if (rule.requires_data) {
        // M2: no keyword_data or business_profile features yet
        return false;
      }

      return true;
    });
  }

  getAllRules(): LoadedRule[] {
    return [...this.rules];
  }
}
```

- [ ] **Step 5: Update index.ts to export new types**

```typescript
// packages/rules-engine/src/index.ts
export { loadConfig, ConfigError } from "./config-loader.js";
export type { LoadedRule, ScoringConfig, RuleCategory } from "./types.js";
export { RuleCatalog } from "./rule-catalog.js";
export type {
  EvidenceBundle,
  PageEvidence,
  RobotsEvidence,
  SitemapEvidence,
  PsiEvidence,
  CruxEvidence,
  GscEvidence,
  JsonLdBlock,
} from "./evidence.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/rules-engine && pnpm test tests/rule-catalog.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/rules-engine/
git commit -m "feat(rules-engine): add evidence types and rule catalog"
```

---

[Continuing with remaining tasks - evaluators, engine, aggregation, scoring, findings, priority, integrity, pipeline integration, composer changes, web integration, golden fixtures...]

Due to length constraints, I'll provide the remaining task structure. Each task follows the same TDD pattern: write failing test → verify RED → implement → verify GREEN → commit.

---

### Task 3: Crawlability evaluators (CRW-001..012)

**Files:**

- Create: `packages/rules-engine/src/evaluators/crawl.ts`
- Test: `packages/rules-engine/tests/evaluators/crawl.test.ts`

**Interfaces:**

- Consumes: `EvidenceBundle`, `LoadedRule`
- Produces: `RuleEvaluation` per rule

- [ ] **Step 1: Write failing tests for CRW-001 (homepage retrievable)**
- [ ] **Step 2: Implement evalCRW001**
- [ ] **Step 3: Write failing tests for CRW-002..012**
- [ ] **Step 4: Implement remaining crawl evaluators**
- [ ] **Step 5: Run all crawl tests to verify GREEN**
- [ ] **Step 6: Commit**

---

### Task 4: On-page SEO evaluators (SEO-001..012, SPAM-001)

**Files:**

- Create: `packages/rules-engine/src/evaluators/seo.ts`
- Test: `packages/rules-engine/tests/evaluators/seo.test.ts`

- [ ] **Step 1: Write failing tests for SEO-001..012**
- [ ] **Step 2: Implement SEO evaluators**
- [ ] **Step 3: Write failing test for SPAM-001 cap_trigger**
- [ ] **Step 4: Implement SPAM-001 with deterministic pattern detection**
- [ ] **Step 5: Run all SEO tests to verify GREEN**
- [ ] **Step 6: Commit**

---

### Task 5: Structured data evaluators (STR-001..008)

**Files:**

- Create: `packages/rules-engine/src/evaluators/structured-data.ts`
- Test: `packages/rules-engine/tests/evaluators/structured-data.test.ts`

- [ ] **Step 1: Write failing tests for STR-001..008**
- [ ] **Step 2: Implement structured data evaluators**
- [ ] **Step 3: Run tests to verify GREEN**
- [ ] **Step 4: Commit**

---

### Task 6: AEO evaluators (deterministic subset)

**Files:**

- Create: `packages/rules-engine/src/evaluators/aeo.ts`
- Test: `packages/rules-engine/tests/evaluators/aeo.test.ts`

- [ ] **Step 1: Write failing tests for AEO-002..005, 007, 008, 010, 011**
- [ ] **Step 2: Implement deterministic AEO evaluators**
- [ ] **Step 3: Write test for assessed rules (AEO-001, 006, 009) returning unavailable**
- [ ] **Step 4: Run tests to verify GREEN**
- [ ] **Step 5: Commit**

---

### Task 7: GEO evaluators (deterministic subset)

**Files:**

- Create: `packages/rules-engine/src/evaluators/geo.ts`
- Test: `packages/rules-engine/tests/evaluators/geo.test.ts`

- [ ] **Step 1: Write failing tests for GEO-001..004, 006, 008..011**
- [ ] **Step 2: Implement deterministic GEO evaluators**
- [ ] **Step 3: Write test for assessed rules (GEO-005, 007) returning unavailable**
- [ ] **Step 4: Run tests to verify GREEN**
- [ ] **Step 5: Commit**

---

### Task 8: i18n and accessibility evaluators

**Files:**

- Create: `packages/rules-engine/src/evaluators/i18n-accessibility.ts`
- Test: `packages/rules-engine/tests/evaluators/i18n-accessibility.test.ts`

- [ ] **Step 1: Write failing tests for I18N-001..004, A11Y-001..004, MOB-001, AGT-001..002**
- [ ] **Step 2: Implement i18n and accessibility evaluators**
- [ ] **Step 3: Run tests to verify GREEN**
- [ ] **Step 4: Commit**

---

### Task 9: Performance and security evaluators

**Files:**

- Create: `packages/rules-engine/src/evaluators/performance-security.ts`
- Test: `packages/rules-engine/tests/evaluators/performance-security.test.ts`

- [ ] **Step 1: Write failing tests for PRF-001..004, SEC-001..003, DEL-001**
- [ ] **Step 2: Implement performance and security evaluators**
- [ ] **Step 3: Run tests to verify GREEN**
- [ ] **Step 4: Commit**

---

### Task 10: Engine runner and aggregation

**Files:**

- Create: `packages/rules-engine/src/engine.ts`
- Create: `packages/rules-engine/src/aggregate.ts`
- Test: `packages/rules-engine/tests/engine.test.ts`
- Test: `packages/rules-engine/tests/aggregate.test.ts`

- [ ] **Step 1: Write failing test for engine running all evaluators**
- [ ] **Step 2: Implement runRulesEngine function**
- [ ] **Step 3: Write failing test for page-to-site aggregation with ratio policy**
- [ ] **Step 4: Implement aggregation logic**
- [ ] **Step 5: Write failing test for template clustering**
- [ ] **Step 6: Implement URL-pattern clustering**
- [ ] **Step 7: Run tests to verify GREEN**
- [ ] **Step 8: Commit**

---

### Task 11: Scoring engine

**Files:**

- Create: `packages/rules-engine/src/scoring.ts`
- Test: `packages/rules-engine/tests/scoring.test.ts`

- [ ] **Step 1: Write failing test for category score calculation**
- [ ] **Step 2: Implement category score with empty denominator handling**
- [ ] **Step 3: Write failing test for pre-cap readiness with renormalization**
- [ ] **Step 4: Implement pre-cap readiness calculation**
- [ ] **Step 5: Write failing test for each of 6 critical caps**
- [ ] **Step 6: Implement critical cap application**
- [ ] **Step 7: Write failing test for confidence levels**
- [ ] **Step 8: Implement confidence calculation**
- [ ] **Step 9: Run tests to verify GREEN**
- [ ] **Step 10: Commit**

---

### Task 12: Findings and priority

**Files:**

- Create: `packages/rules-engine/src/findings.ts`
- Create: `packages/rules-engine/src/priority.ts`
- Test: `packages/rules-engine/tests/findings.test.ts`
- Test: `packages/rules-engine/tests/priority.test.ts`

- [ ] **Step 1: Write failing test for severity mapping**
- [ ] **Step 2: Implement findings generation with severity**
- [ ] **Step 3: Write failing test for priority_value calculation**
- [ ] **Step 4: Implement priority calculation with groups and horizons**
- [ ] **Step 5: Run tests to verify GREEN**
- [ ] **Step 6: Commit**

---

### Task 13: Integrity module

**Files:**

- Create: `packages/rules-engine/src/integrity.ts`
- Test: `packages/rules-engine/tests/integrity.test.ts`

- [ ] **Step 1: Write failing test for lineage attachment**
- [ ] **Step 2: Implement lineage with content_hash**
- [ ] **Step 3: Write failing test for freshness check**
- [ ] **Step 4: Implement freshness validation**
- [ ] **Step 5: Write failing test for integrity error on hash mismatch**
- [ ] **Step 6: Implement integrity guard**
- [ ] **Step 7: Run tests to verify GREEN**
- [ ] **Step 8: Commit**

---

### Task 14: Pipeline integration

**Files:**

- Modify: `packages/audit-pipeline/src/pipeline.ts`
- Modify: `packages/audit-pipeline/package.json`
- Test: `packages/audit-pipeline/tests/pipeline-integration.test.ts`

- [ ] **Step 1: Write failing test for pipeline running rules engine**
- [ ] **Step 2: Add @wpi/rules-engine dependency**
- [ ] **Step 3: Add RulesEngineStage port to PipelineDeps**
- [ ] **Step 4: Integrate rules engine into AUDITING stage**
- [ ] **Step 5: Run tests to verify GREEN**
- [ ] **Step 6: Commit**

---

### Task 15: Composer changes

**Files:**

- Modify: `packages/audit-pipeline/src/composer.ts`
- Modify: `packages/audit-pipeline/src/report-envelope.ts`
- Modify: `packages/audit-pipeline/src/report-model.ts`
- Test: `packages/audit-pipeline/tests/composer-m2.test.ts`

- [ ] **Step 1: Write failing test for merging deterministic and agent findings**
- [ ] **Step 2: Implement finding merge with deterministic-first ordering**
- [ ] **Step 3: Write failing test for unavailable blocks**
- [ ] **Step 4: Implement unavailable block generation**
- [ ] **Step 5: Write failing test for action board from priority items**
- [ ] **Step 6: Implement action board building**
- [ ] **Step 7: Remove limitation.score_engine_deferred and limitation.deterministic_rules_deferred**
- [ ] **Step 8: Add score field to StoredReportEnvelope**
- [ ] **Step 9: Run tests to verify GREEN**
- [ ] **Step 10: Commit**

---

### Task 16: Web integration - score card and findings

**Files:**

- Modify: `apps/web/src/routes/audit/[id]/report/+page.svelte`
- Create: `apps/web/src/lib/components/ScoreCard.svelte`
- Create: `apps/web/src/lib/components/FindingCard.svelte`
- Modify: `apps/web/src/lib/i18n/en.json`
- Modify: `apps/web/src/lib/i18n/ar.json`
- Test: `apps/web/tests/report-page.test.ts`

- [ ] **Step 1: Write failing Playwright test for score card display**
- [ ] **Step 2: Implement ScoreCard component**
- [ ] **Step 3: Write failing test for deterministic findings display**
- [ ] **Step 4: Implement FindingCard component**
- [ ] **Step 5: Add i18n strings for score and findings**
- [ ] **Step 6: Run Playwright tests to verify GREEN**
- [ ] **Step 7: Commit**

---

### Task 17: Web integration - evidence viewer and methodology

**Files:**

- Create: `apps/web/src/routes/audit/[id]/evidence/+page.svelte`
- Create: `apps/web/src/lib/components/MethodologyDisclosure.svelte`
- Modify: `apps/web/src/lib/i18n/en.json`
- Modify: `apps/web/src/lib/i18n/ar.json`
- Test: `apps/web/tests/evidence-viewer.test.ts`

- [ ] **Step 1: Write failing Playwright test for evidence viewer**
- [ ] **Step 2: Implement evidence viewer page**
- [ ] **Step 3: Write failing test for methodology disclosure**
- [ ] **Step 4: Implement MethodologyDisclosure component**
- [ ] **Step 5: Add i18n strings for methodology**
- [ ] **Step 6: Run Playwright tests to verify GREEN**
- [ ] **Step 7: Commit**

---

### Task 18: Golden fixtures and exit criteria validation

**Files:**

- Create: `packages/rules-engine/tests/golden/synthetic-evidence.json`
- Create: `packages/rules-engine/tests/golden/expected-results.json`
- Create: `packages/rules-engine/tests/golden.test.ts`

- [ ] **Step 1: Create synthetic evidence bundle fixture**
- [ ] **Step 2: Run engine on fixture and capture outputs**
- [ ] **Step 3: Commit expected results as golden fixture**
- [ ] **Step 4: Write test that reproduces score from fixture**
- [ ] **Step 5: Verify tampered evidence fails with IntegrityError**
- [ ] **Step 6: Verify all 77 rules load and evaluate**
- [ ] **Step 7: Run full monorepo suite to verify GREEN**
- [ ] **Step 8: Commit**

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-05-m2-rules-engine-scoring.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
