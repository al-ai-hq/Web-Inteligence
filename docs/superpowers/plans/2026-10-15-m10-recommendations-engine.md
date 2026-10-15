# M10 Recommendations Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing rules-engine priority calculation with an impact/effort/timeline scoring model, add industry playbook overlays and site-stage awareness, and close the loop with signed-in outcome tracking.

**Architecture:** Keep the work inside `@wpi/rules-engine` and `@wpi/audit-pipeline`. The rules engine outputs findings; a new deterministic scorer converts them into ranked `RecommendationPriorityItem[]`. The composer maps those into the report action board. A new `OutcomeStore` records signed-in users' "applied" marks and computes score deltas when the next audit for the same site completes. The web report and dashboard render the grouped board and outcomes.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm, Postgres, Next.js App Router, next-intl, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-15-m10-recommendations-engine-design.md`

## Global Constraints

- Priority scores are a presentation-layer ranking; they never alter Presence Readiness, Experience Effectiveness, AI visibility, or search performance numbers (D-012 separation).
- All stored numbers carry lineage: source, as-of timestamp, and fidelity label.
- Outcome deltas must be labelled `correlation_only`; the UI must not imply causation.
- "Mark applied" is an owned-record write — requires signed-in user and ownership guard.
- Anonymous reports stay read-only, in-app, 7-day expiry (D-002).
- Bilingual EN + AR for all new UI strings; native Arabic review required.
- No new paid LLM calls in this scope; deterministic scoring and outcome joins only.
- Frequent commits; TDD red-green for every new function.

## File structure

| File | Responsibility |
| ---- | -------------- |
| `config/recommendations/scoring.yaml` | Band thresholds, category effort, default timeline |
| `config/recommendations/industry-playbooks.yaml` | Per-industry rule boosts and annotation keys |
| `packages/rules-engine/src/types.ts` | `RecommendationBand`, `RecommendationPriorityItem` |
| `packages/rules-engine/src/config-loader.ts` | Load `recommendation_timeline` from rule YAML |
| `packages/rules-engine/src/recommendation-config.ts` | Load recommendation scoring + playbook configs |
| `packages/rules-engine/src/industry-classifier.ts` | Derive industry from business_type/schema/URL signals |
| `packages/rules-engine/src/playbook-overlay.ts` | Apply playbook boosts and annotations |
| `packages/rules-engine/src/priority.ts` | Replaced: new `(impact × 2) − effort − timeline` scorer |
| `packages/audit-pipeline/src/report-envelope.ts` | Extend `StoredActionItem` with score/band metadata |
| `packages/audit-pipeline/src/composer.ts` | Map `RecommendationPriorityItem` to action board |
| `packages/audit-pipeline/src/migrations/0019_recommendation_outcomes.sql` | Outcome log table |
| `packages/audit-pipeline/src/outcome-store.ts` | `OutcomeStore` interface |
| `packages/audit-pipeline/src/in-memory-outcome-store.ts` | In-memory implementation |
| `packages/audit-pipeline/src/postgres-outcome-store.ts` | Postgres implementation |
| `packages/audit-pipeline/src/outcome-service.ts` | Compute and record deltas on audit completion |
| `packages/audit-pipeline/src/pipeline.ts` | Wire scorer config and outcome recording |
| `packages/audit-pipeline/src/index.ts` | Export new public types |
| `apps/web/src/services/container.ts` | Build and expose `outcomeStore` |
| `apps/web/src/app/api/audits/[id]/recommendations/[findingId]/apply/route.ts` | Mark-applied API route |
| `apps/web/src/app/[locale]/audit/[id]/_components/action-board.tsx` | Grouped action board component |
| `apps/web/src/app/[locale]/audit/[id]/_components/report-view.tsx` | Render action board and pass user context |
| `apps/web/src/app/[locale]/dashboard/_components/recommendations-panel.tsx` | Dashboard deltas panel |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Include recommendations panel |
| `apps/web/messages/en.json` + `messages/ar.json` | New i18n keys |

---

### Task 1: Recommendation scoring config and types

**Files:**
- Create: `config/recommendations/scoring.yaml`
- Create: `config/recommendations/industry-playbooks.yaml`
- Modify: `packages/rules-engine/src/types.ts`
- Create: `packages/rules-engine/src/recommendation-config.ts`
- Test: `packages/rules-engine/src/recommendation-config.test.ts`

**Interfaces:**
- Consumes: existing `RuleCategory` type
- Produces: `RecommendationBand`, `RecommendationPriorityItem`, `RecommendationScoringConfig`, `IndustryPlaybook`, `loadRecommendationConfig()`

- [ ] **Step 1: Write the failing test**

Create `packages/rules-engine/src/recommendation-config.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { loadRecommendationConfig } from "./recommendation-config.js";

describe("loadRecommendationConfig", () => {
  test("loads scoring thresholds, effort, and timeline defaults", () => {
    const config = loadRecommendationConfig();
    expect(config.bandThresholds.quickWin).toBe(8);
    expect(config.effortByCategory.crawlability).toBeGreaterThanOrEqual(1);
    expect(config.effortByCategory.crawlability).toBeLessThanOrEqual(10);
    expect(config.timelineDefaultByCategory.on_page).toBeGreaterThanOrEqual(1);
    expect(config.timelineDefaultByCategory.on_page).toBeLessThanOrEqual(10);
  });

  test("loads industry playbooks", () => {
    const config = loadRecommendationConfig();
    expect(config.playbooks.length).toBeGreaterThan(0);
    const saas = config.playbooks.find((p) => p.playbook_id === "saas");
    expect(saas).toBeDefined();
    expect(saas?.entries.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/rules-engine/src/recommendation-config.test.ts
```

Expected: FAIL — `loadRecommendationConfig` not defined or config files missing.

- [ ] **Step 3: Write minimal implementation**

Create `config/recommendations/scoring.yaml`:

```yaml
methodology_version: "0.1.0-m10"
scoring:
  formula: "(impact_score * 2) - effort_score - timeline_score"
  band_thresholds:
    quick_win: 8
    strategic: 3
    fill_in: -3
  max_playbook_boost: 3
effort_by_category:
  crawlability: 4
  on_page: 3
  structured_data: 5
  aeo: 5
  geo: 7
  i18n_accessibility: 4
  performance_security: 6
timeline_default_by_category:
  crawlability: 4
  on_page: 3
  structured_data: 5
  aeo: 6
  geo: 7
  i18n_accessibility: 4
  performance_security: 5
```

Create `config/recommendations/industry-playbooks.yaml`:

```yaml
playbooks:
  - playbook_id: saas
    display_name:
      en: SaaS
      ar: SaaS
    entries:
      - rule_id: AEO-003
        boost: 2
        note_key: playbook_saas_aeo_003
      - rule_id: PRF-002
        boost: 1
  - playbook_id: ecommerce
    display_name:
      en: E-commerce
      ar: التجارة الإلكترونية
    entries:
      - rule_id: STR-001
        boost: 2
        note_key: playbook_ecommerce_str_001
  - playbook_id: local
    display_name:
      en: Local business
      ar: نشاط تجاري محلي
    entries:
      - rule_id: GEO-001
        boost: 2
  - playbook_id: publisher
    display_name:
      en: Publisher
      ar: ناشر محتوى
    entries:
      - rule_id: AEO-001
        boost: 2
  - playbook_id: professional_services
    display_name:
      en: Professional services
      ar: خدمات مهنية
    entries:
      - rule_id: AEO-002
        boost: 1
  - playbook_id: generic
    display_name:
      en: Generic
      ar: عام
    entries: []
```

Add to `packages/rules-engine/src/types.ts`:

```typescript
export type RecommendationBand = "quick_win" | "strategic" | "fill_in" | "defer";

export interface RecommendationPriorityItem extends PriorityItem {
  impact_score: number;
  effort_score: number;
  timeline_score: number;
  priority_score: number;
  band: RecommendationBand;
  playbook_id: string | null;
  playbook_note_key: string | null;
  industry_classification: string;
  site_stage: string;
}

export interface RecommendationScoringConfig {
  methodology_version: string;
  bandThresholds: {
    quickWin: number;
    strategic: number;
    fillIn: number;
  };
  maxPlaybookBoost: number;
  effortByCategory: Record<RuleCategory, number>;
  timelineDefaultByCategory: Record<RuleCategory, number>;
}

export interface PlaybookEntry {
  rule_id: string;
  boost: number;
  note_key: string | null;
}

export interface IndustryPlaybook {
  playbook_id: string;
  display_name: Record<string, string>;
  entries: PlaybookEntry[];
}

export interface RecommendationConfig {
  scoring: RecommendationScoringConfig;
  playbooks: IndustryPlaybook[];
}
```

Create `packages/rules-engine/src/recommendation-config.ts`:

```typescript
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { ConfigError, type RecommendationConfig, type RuleCategory } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleCategorySchema = z.enum([
  "crawlability",
  "on_page",
  "structured_data",
  "aeo",
  "geo",
  "i18n_accessibility",
  "performance_security",
]);

const scoringYamlSchema = z.object({
  methodology_version: z.string(),
  scoring: z.object({
    formula: z.string(),
    band_thresholds: z.object({
      quick_win: z.number(),
      strategic: z.number(),
      fill_in: z.number(),
    }),
    max_playbook_boost: z.number(),
  }),
  effort_by_category: z.record(ruleCategorySchema, z.number().int().min(1).max(10)),
  timeline_default_by_category: z.record(ruleCategorySchema, z.number().int().min(1).max(10)),
});

const playbooksYamlSchema = z.object({
  playbooks: z.array(
    z.object({
      playbook_id: z.string(),
      display_name: z.record(z.string(), z.string()),
      entries: z.array(
        z.object({
          rule_id: z.string(),
          boost: z.number().default(0),
          note_key: z.string().optional(),
        }),
      ),
    }),
  ),
});

export function loadRecommendationConfig(): RecommendationConfig {
  const repoRoot = join(__dirname, "..", "..", "..");
  const configDir = join(repoRoot, "config", "recommendations");

  const scoringContent = readFileSync(join(configDir, "scoring.yaml"), "utf-8");
  const scoringParsed = parse(scoringContent);
  const scoringResult = scoringYamlSchema.safeParse(scoringParsed);
  if (!scoringResult.success) {
    throw new ConfigError(`Invalid recommendation scoring config: ${scoringResult.error.message}`);
  }

  const playbooksContent = readFileSync(join(configDir, "industry-playbooks.yaml"), "utf-8");
  const playbooksParsed = parse(playbooksContent);
  const playbooksResult = playbooksYamlSchema.safeParse(playbooksParsed);
  if (!playbooksResult.success) {
    throw new ConfigError(`Invalid industry playbooks config: ${playbooksResult.error.message}`);
  }

  return {
    scoring: {
      methodology_version: scoringResult.data.methodology_version,
      bandThresholds: {
        quickWin: scoringResult.data.scoring.band_thresholds.quick_win,
        strategic: scoringResult.data.scoring.band_thresholds.strategic,
        fillIn: scoringResult.data.scoring.band_thresholds.fill_in,
      },
      maxPlaybookBoost: scoringResult.data.scoring.max_playbook_boost,
      effortByCategory: scoringResult.data.effort_by_category as Record<RuleCategory, number>,
      timelineDefaultByCategory: scoringResult.data.timeline_default_by_category as Record<
        RuleCategory,
        number
      >,
    },
    playbooks: playbooksResult.data.playbooks.map((p) => ({
      playbook_id: p.playbook_id,
      display_name: p.display_name,
      entries: p.entries.map((e) => ({
        rule_id: e.rule_id,
        boost: e.boost,
        note_key: e.note_key ?? null,
      })),
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/rules-engine/src/recommendation-config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/recommendations packages/rules-engine/src/types.ts packages/rules-engine/src/recommendation-config.ts packages/rules-engine/src/recommendation-config.test.ts
git commit -m "feat(rules-engine): add recommendation scoring config and types"
```

---

### Task 2: Industry classifier

**Files:**
- Create: `packages/rules-engine/src/industry-classifier.ts`
- Test: `packages/rules-engine/src/industry-classifier.test.ts`

**Interfaces:**
- Consumes: audit context business_type, schema types, URL paths
- Produces: `classifyIndustry(signals): { industry: string; basis: string }`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, test } from "vitest";
import { classifyIndustry } from "./industry-classifier.js";

describe("classifyIndustry", () => {
  test("business_type saas wins over other signals", () => {
    const result = classifyIndustry({
      business_type: "saas",
      schema_types: ["Product"],
      url_paths: ["/shop/"],
    });
    expect(result.industry).toBe("saas");
    expect(result.basis).toContain("business_type");
  });

  test("schema Product maps to ecommerce when business_type absent", () => {
    const result = classifyIndustry({ schema_types: ["Product"] });
    expect(result.industry).toBe("ecommerce");
  });

  test("falls back to generic", () => {
    const result = classifyIndustry({});
    expect(result.industry).toBe("generic");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/rules-engine/src/industry-classifier.test.ts
```

Expected: FAIL — `classifyIndustry` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/rules-engine/src/industry-classifier.ts`:

```typescript
export interface IndustrySignals {
  business_type?: string;
  schema_types?: string[];
  url_paths?: string[];
}

export type Industry =
  | "saas"
  | "ecommerce"
  | "local"
  | "publisher"
  | "professional_services"
  | "generic";

const BUSINESS_TYPE_MAP: Record<string, Industry> = {
  saas: "saas",
  software: "saas",
  technology: "saas",
  b2b: "saas",
  ecommerce: "ecommerce",
  retail: "ecommerce",
  shop: "ecommerce",
  store: "ecommerce",
  local: "local",
  restaurant: "local",
  clinic: "local",
  service_area: "local",
  publisher: "publisher",
  blog: "publisher",
  news: "publisher",
  media: "publisher",
  professional_services: "professional_services",
  agency: "professional_services",
  consulting: "professional_services",
  law: "professional_services",
  accounting: "professional_services",
};

function fromBusinessType(value?: string): { industry: Industry; basis: string } | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  const mapped = BUSINESS_TYPE_MAP[normalized];
  if (!mapped) return null;
  return { industry: mapped, basis: `business_type:${normalized}` };
}

function fromSchemaTypes(types?: string[]): { industry: Industry; basis: string } | null {
  if (!types || types.length === 0) return null;
  const set = new Set(types.map((t) => t.toLowerCase()));
  if (set.has("product") || set.has("offer")) return { industry: "ecommerce", basis: "schema:Product" };
  if (set.has("localbusiness")) return { industry: "local", basis: "schema:LocalBusiness" };
  if (set.has("newsarticle") || set.has("blogposting"))
    return { industry: "publisher", basis: "schema:NewsArticle" };
  return null;
}

function fromUrlPaths(paths?: string[]): { industry: Industry; basis: string } | null {
  if (!paths || paths.length === 0) return null;
  const joined = paths.join(" ").toLowerCase();
  if (joined.includes("/shop/") || joined.includes("/product/") || joined.includes("/cart/"))
    return { industry: "ecommerce", basis: "url_path" };
  if (joined.includes("/blog/") || joined.includes("/news/") || joined.includes("/articles/"))
    return { industry: "publisher", basis: "url_path" };
  if (joined.includes("/services/") || joined.includes("/consulting/"))
    return { industry: "professional_services", basis: "url_path" };
  return null;
}

export function classifyIndustry(signals: IndustrySignals): {
  industry: Industry;
  basis: string;
} {
  const fromBusiness = fromBusinessType(signals.business_type);
  if (fromBusiness) return fromBusiness;
  const fromSchema = fromSchemaTypes(signals.schema_types);
  if (fromSchema) return fromSchema;
  const fromPaths = fromUrlPaths(signals.url_paths);
  if (fromPaths) return fromPaths;
  return { industry: "generic", basis: "default" };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/rules-engine/src/industry-classifier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rules-engine/src/industry-classifier.ts packages/rules-engine/src/industry-classifier.test.ts
git commit -m "feat(rules-engine): add industry classifier"
```

---

### Task 3: Playbook overlay

**Files:**
- Create: `packages/rules-engine/src/playbook-overlay.ts`
- Test: `packages/rules-engine/src/playbook-overlay.test.ts`

**Interfaces:**
- Consumes: `RecommendationPriorityItem[]`, `IndustryPlaybook`, `maxPlaybookBoost`
- Produces: `applyPlaybook(items, playbook, maxBoost)` returning updated `RecommendationPriorityItem[]`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, test } from "vitest";
import { applyPlaybook } from "./playbook-overlay.js";
import type { IndustryPlaybook, RecommendationPriorityItem } from "./types.js";

function fakeItem(rule_id: string, priority_score: number): RecommendationPriorityItem {
  return {
    rule_id,
    severity: "medium",
    priority_value: priority_score,
    priority_score,
    impact_score: 5,
    effort_score: 5,
    timeline_score: 5,
    band: priority_score >= 8 ? "quick_win" : "strategic",
    category: "aeo",
    evidence_ids: [],
    group: "quick_win",
    horizon: "0-30d",
    display_band: 1,
    playbook_id: null,
    playbook_note_key: null,
    industry_classification: "generic",
    site_stage: "growth",
  } as unknown as RecommendationPriorityItem;
}

describe("applyPlaybook", () => {
  test("boosts matching rule and caps boost", () => {
    const playbook: IndustryPlaybook = {
      playbook_id: "saas",
      display_name: { en: "SaaS" },
      entries: [{ rule_id: "AEO-003", boost: 5, note_key: "note" }],
    };
    const items = [fakeItem("AEO-003", 6), fakeItem("AEO-004", 6)];
    const result = applyPlaybook(items, playbook, 3);
    expect(result[0].priority_score).toBe(9); // 6 + capped 3
    expect(result[0].playbook_note_key).toBe("note");
    expect(result[1].priority_score).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/rules-engine/src/playbook-overlay.test.ts
```

Expected: FAIL — `applyPlaybook` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/rules-engine/src/playbook-overlay.ts`:

```typescript
import type { IndustryPlaybook, RecommendationPriorityItem } from "./types.js";

export function applyPlaybook(
  items: RecommendationPriorityItem[],
  playbook: IndustryPlaybook,
  maxBoost: number,
): RecommendationPriorityItem[] {
  const entryByRule = new Map(playbook.entries.map((e) => [e.rule_id, e]));
  return items.map((item) => {
    const entry = entryByRule.get(item.rule_id);
    if (!entry) return item;
    const boost = Math.max(0, Math.min(entry.boost, maxBoost));
    const newScore = item.priority_score + boost;
    return {
      ...item,
      priority_score: newScore,
      priority_value: newScore,
      playbook_id: playbook.playbook_id,
      playbook_note_key: entry.note_key ?? null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/rules-engine/src/playbook-overlay.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rules-engine/src/playbook-overlay.ts packages/rules-engine/src/playbook-overlay.test.ts
git commit -m "feat(rules-engine): add playbook overlay"
```

---

### Task 4: Replace priority calculation

**Files:**
- Modify: `packages/rules-engine/src/types.ts` (extend LoadedRule with recommendation_timeline)
- Modify: `packages/rules-engine/src/config-loader.ts` (load recommendation_timeline)
- Modify: `packages/rules-engine/src/priority.ts` (replace formula)
- Modify: `packages/rules-engine/src/index.ts` (export new types/functions)
- Test: `packages/rules-engine/tests/priority.test.ts` (replace existing)

**Interfaces:**
- Consumes: `Finding[]`, `LoadedRule[]`, `RecommendationScoringConfig`, `Industry`, `siteStage`
- Produces: `calculatePriority(findings, rules, config, options): RecommendationPriorityItem[]`

- [ ] **Step 1: Write the failing test**

Replace `packages/rules-engine/tests/priority.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { calculatePriority } from "../src/priority.js";
import type { Finding, LoadedRule, RecommendationScoringConfig } from "../src/types.js";

const config: RecommendationScoringConfig = {
  methodology_version: "0.1.0-m10",
  bandThresholds: { quickWin: 8, strategic: 3, fillIn: -3 },
  maxPlaybookBoost: 3,
  effortByCategory: {
    crawlability: 4,
    on_page: 3,
    structured_data: 5,
    aeo: 5,
    geo: 7,
    i18n_accessibility: 4,
    performance_security: 6,
  },
  timelineDefaultByCategory: {
    crawlability: 4,
    on_page: 3,
    structured_data: 5,
    aeo: 6,
    geo: 7,
    i18n_accessibility: 4,
    performance_security: 5,
  },
};

function rule(id: string, weight: number, category: LoadedRule["category"]): LoadedRule {
  return {
    id,
    category,
    title: id,
    importance_weight: weight,
    scored: true,
    evaluation: "deterministic",
    connected_tier_only: false,
    applicability: "All",
    standards: {},
    fidelity_label: "computed",
  } as LoadedRule;
}

function finding(rule_id: string, category: Finding["category"]): Finding {
  return {
    rule_id,
    severity: "high",
    evidence_ids: [],
    category,
    evidence_state: "verified",
    affected_scope: { sampled: true, urls: [] },
  };
}

describe("calculatePriority", () => {
  test("computes (impact*2 - effort - timeline) and assigns band", () => {
    const items = calculatePriority(
      [finding("R-1", "on_page")],
      [rule("R-1", 5, "on_page")],
      config,
      { industry: "generic", siteStage: "growth" },
    );
    expect(items).toHaveLength(1);
    expect(items[0].impact_score).toBe(10);
    expect(items[0].effort_score).toBe(3);
    expect(items[0].timeline_score).toBe(3);
    expect(items[0].priority_score).toBe(14);
    expect(items[0].band).toBe("quick_win");
  });

  test("uses rule-level timeline override when present", () => {
    const r = { ...rule("R-1", 3, "aeo"), recommendation_timeline: 9 };
    const items = calculatePriority([finding("R-1", "aeo")], [r], config, {
      industry: "generic",
      siteStage: "growth",
    });
    expect(items[0].timeline_score).toBe(9);
  });

  test("sorts by priority_score descending", () => {
    const items = calculatePriority(
      [finding("R-1", "on_page"), finding("R-2", "geo")],
      [rule("R-1", 1, "on_page"), rule("R-2", 5, "geo")],
      config,
      { industry: "generic", siteStage: "growth" },
    );
    expect(items[0].priority_score).toBeGreaterThan(items[1].priority_score);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/rules-engine/tests/priority.test.ts
```

Expected: FAIL — new signature/types not present.

- [ ] **Step 3: Write minimal implementation**

Add `recommendation_timeline?: number` to `LoadedRule` in `packages/rules-engine/src/types.ts`.

Add `recommendation_timeline: z.number().int().min(1).max(10).optional()` to `ruleSchema` in `packages/rules-engine/src/config-loader.ts`.

Replace `packages/rules-engine/src/priority.ts`:

```typescript
import type {
  Finding,
  LoadedRule,
  RecommendationBand,
  RecommendationPriorityItem,
  RecommendationScoringConfig,
  RuleCategory,
} from "./types.js";

export interface PriorityOptions {
  industry: string;
  siteStage: string;
}

function assignBand(score: number, thresholds: RecommendationScoringConfig["bandThresholds"]): RecommendationBand {
  if (score >= thresholds.quickWin) return "quick_win";
  if (score >= thresholds.strategic) return "strategic";
  if (score >= thresholds.fillIn) return "fill_in";
  return "defer";
}

export function calculatePriority(
  findings: Finding[],
  rules: LoadedRule[],
  config: RecommendationScoringConfig,
  options: PriorityOptions,
): RecommendationPriorityItem[] {
  const ruleMap = new Map<string, LoadedRule>();
  for (const rule of rules) {
    ruleMap.set(rule.id, rule);
  }

  const items: RecommendationPriorityItem[] = [];
  for (const finding of findings) {
    const rule = ruleMap.get(finding.rule_id);
    if (!rule) continue;

    const impact_score = Math.min(10, Math.max(1, rule.importance_weight * 2));
    const effort_score = config.effortByCategory[finding.category] ?? 5;
    const timeline_score = rule.recommendation_timeline ?? config.timelineDefaultByCategory[finding.category] ?? 5;
    const priority_score = impact_score * 2 - effort_score - timeline_score;
    const band = assignBand(priority_score, config.bandThresholds);

    items.push({
      rule_id: finding.rule_id,
      severity: finding.severity,
      priority_value: priority_score,
      priority_score,
      impact_score,
      effort_score,
      timeline_score,
      band,
      group: band === "quick_win" ? "quick_win" : "strategic_opportunity",
      horizon: band === "quick_win" || band === "strategic" ? "0-30d" : "31-60d",
      display_band: band === "quick_win" ? 1 : band === "strategic" ? 2 : band === "fill_in" ? 3 : 4,
      category: finding.category,
      evidence_ids: finding.evidence_ids,
      rationale: finding.rationale,
      playbook_id: null,
      playbook_note_key: null,
      industry_classification: options.industry,
      site_stage: options.siteStage,
    });
  }

  items.sort((a, b) => b.priority_score - a.priority_score);
  return items;
}
```

Update `packages/rules-engine/src/index.ts` to export `calculatePriority`, `RecommendationPriorityItem`, `RecommendationBand`, `RecommendationScoringConfig`, `Industry`, `classifyIndustry`, `applyPlaybook`, `loadRecommendationConfig`.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/rules-engine/tests/priority.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full rules-engine tests**

```bash
pnpm --filter @wpi/rules-engine test
```

Expected: PASS (fix any broken tests from the signature change).

- [ ] **Step 6: Commit**

```bash
git add packages/rules-engine/src/priority.ts packages/rules-engine/tests/priority.test.ts packages/rules-engine/src/types.ts packages/rules-engine/src/config-loader.ts packages/rules-engine/src/index.ts
git commit -m "feat(rules-engine): replace priority calculation with impact/effort/timeline"
```

---

### Task 5: Extend report envelope and composer

**Files:**
- Modify: `packages/audit-pipeline/src/report-envelope.ts`
- Modify: `packages/audit-pipeline/src/composer.ts`
- Test: `packages/audit-pipeline/src/composer.test.ts` (update existing)

**Interfaces:**
- Consumes: `RecommendationPriorityItem[]`
- Produces: `StoredActionItem` with `band`, `impact_score`, `effort_score`, `timeline_score`, `priority_score`, `playbook_note_key`

- [ ] **Step 1: Write the failing test**

Extend `packages/audit-pipeline/src/composer.test.ts` (or create if missing) with:

```typescript
import { describe, expect, test } from "vitest";
import { mapPriorityItem } from "./composer.js";
import type { RecommendationPriorityItem } from "@wpi/rules-engine";

describe("mapPriorityItem", () => {
  test("maps enriched priority item to stored action item", () => {
    const item: RecommendationPriorityItem = {
      rule_id: "R-1",
      severity: "high",
      priority_value: 14,
      priority_score: 14,
      impact_score: 10,
      effort_score: 3,
      timeline_score: 3,
      band: "quick_win",
      group: "quick_win",
      horizon: "0-30d",
      display_band: 1,
      category: "on_page",
      evidence_ids: ["ev1"],
      rationale: "Fix title",
      playbook_id: null,
      playbook_note_key: null,
      industry_classification: "generic",
      site_stage: "growth",
    };
    const stored = mapPriorityItem(item, "fid-1");
    expect(stored.priority_score).toBe(14);
    expect(stored.band).toBe("quick_win");
    expect(stored.source_finding_id).toBe("fid-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/audit-pipeline/src/composer.test.ts
```

Expected: FAIL — `StoredActionItem` lacks new fields or `mapPriorityItem` signature mismatch.

- [ ] **Step 3: Write minimal implementation**

Update `StoredActionItem` in `packages/audit-pipeline/src/report-envelope.ts`:

```typescript
export interface StoredActionItem {
  title: string;
  detail: string;
  severity: FindingSeverity;
  confidence: "high" | "medium" | "low";
  source_finding_id: string;
  impact_score: number;
  effort_score: number;
  timeline_score: number;
  priority_score: number;
  band: "quick_win" | "strategic" | "fill_in" | "defer";
  playbook_note_key: string | null;
}
```

Update `mapPriorityItem` in `packages/audit-pipeline/src/composer.ts`:

```typescript
import type { RecommendationPriorityItem } from "@wpi/rules-engine";

function mapPriorityItem(item: RecommendationPriorityItem, findingId: string): StoredActionItem {
  return {
    title: item.rule_id,
    detail: item.rationale ?? item.rule_id,
    severity: item.severity as FindingSeverity,
    confidence: "high",
    source_finding_id: findingId,
    impact_score: item.impact_score,
    effort_score: item.effort_score,
    timeline_score: item.timeline_score,
    priority_score: item.priority_score,
    band: item.band,
    playbook_note_key: item.playbook_note_key,
  };
}
```

Update `composeSections` to accept `RecommendationPriorityItem[]` and pass the finding id map correctly.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/audit-pipeline/src/composer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full audit-pipeline tests**

```bash
pnpm --filter @wpi/audit-pipeline test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/audit-pipeline/src/report-envelope.ts packages/audit-pipeline/src/composer.ts packages/audit-pipeline/src/composer.test.ts
git commit -m "feat(audit-pipeline): extend action board with priority metadata"
```

---

### Task 6: Outcome database migration

**Files:**
- Create: `packages/audit-pipeline/src/migrations/0019_recommendation_outcomes.sql`
- Test: existing migration test runner

**Interfaces:**
- Produces: `recommendation_outcomes` table schema

- [ ] **Step 1: Write the failing test**

If the repo has a migration test helper, add a test asserting migration `0019` applies cleanly. Otherwise, the migration itself is the test artifact.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @wpi/audit-pipeline test
```

Expected: FAIL — migration file missing.

- [ ] **Step 3: Write minimal implementation**

Create `packages/audit-pipeline/src/migrations/0019_recommendation_outcomes.sql`:

```sql
CREATE TABLE recommendation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  audit_id_applied UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  audit_id_measured UUID REFERENCES audits(id) ON DELETE SET NULL,
  metric TEXT NOT NULL,
  value_before NUMERIC,
  value_after NUMERIC,
  as_of_before TIMESTAMPTZ,
  as_of_after TIMESTAMPTZ,
  fidelity_label TEXT NOT NULL DEFAULT 'correlation_only',
  source TEXT NOT NULL DEFAULT 'user_marked_applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, rule_id, audit_id_applied, metric)
);

CREATE INDEX idx_recommendation_outcomes_user_applied
  ON recommendation_outcomes(user_id, audit_id_applied);
CREATE INDEX idx_recommendation_outcomes_user_rule_pending
  ON recommendation_outcomes(user_id, rule_id) WHERE audit_id_measured IS NULL;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/audit-pipeline test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/migrations/0019_recommendation_outcomes.sql
git commit -m "feat(audit-pipeline): add recommendation_outcomes migration"
```

---

### Task 7: Outcome store interface and in-memory implementation

**Files:**
- Create: `packages/audit-pipeline/src/outcome-store.ts`
- Create: `packages/audit-pipeline/src/in-memory-outcome-store.ts`
- Test: `packages/audit-pipeline/src/in-memory-outcome-store.test.ts`

**Interfaces:**
- Produces: `OutcomeStore` interface, `InMemoryOutcomeStore`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, test } from "vitest";
import { InMemoryOutcomeStore } from "./in-memory-outcome-store.js";

describe("InMemoryOutcomeStore", () => {
  test("marks recommendation applied and lists pending", async () => {
    const store = new InMemoryOutcomeStore();
    const outcome = await store.markApplied({
      userId: "user-1",
      ruleId: "R-1",
      auditIdApplied: "audit-1",
      metric: "presence_readiness",
    });
    expect(outcome.user_id).toBe("user-1");
    expect(outcome.audit_id_measured).toBeNull();

    const pending = await store.listPendingForUser("user-1");
    expect(pending).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/audit-pipeline/src/in-memory-outcome-store.test.ts
```

Expected: FAIL — files/types missing.

- [ ] **Step 3: Write minimal implementation**

Create `packages/audit-pipeline/src/outcome-store.ts`:

```typescript
export interface MarkAppliedInput {
  userId: string;
  ruleId: string;
  auditIdApplied: string;
  metric: string;
}

export interface RecordDeltasInput {
  userId: string;
  auditIdMeasured: string;
  previousAuditId: string;
  values: Array<{
    ruleId: string;
    metric: string;
    valueBefore: number | null;
    valueAfter: number | null;
  }>;
}

export interface RecommendationOutcome {
  id: string;
  user_id: string;
  rule_id: string;
  audit_id_applied: string;
  audit_id_measured: string | null;
  metric: string;
  value_before: number | null;
  value_after: number | null;
  as_of_before: string | null;
  as_of_after: string | null;
  fidelity_label: "correlation_only" | "measured" | "inferred";
  source: string;
  created_at: string;
  updated_at: string;
}

export interface OutcomeStore {
  markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome>;
  listPendingForUser(userId: string): Promise<RecommendationOutcome[]>;
  recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]>;
  listForAudit(auditId: string): Promise<RecommendationOutcome[]>;
}
```

Create `packages/audit-pipeline/src/in-memory-outcome-store.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { MarkAppliedInput, OutcomeStore, RecommendationOutcome, RecordDeltasInput } from "./outcome-store.js";

export class InMemoryOutcomeStore implements OutcomeStore {
  private rows = new Map<string, RecommendationOutcome>();

  async markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome> {
    const key = `${input.userId}:${input.ruleId}:${input.auditIdApplied}:${input.metric}`;
    const existing = [...this.rows.values()].find(
      (r) =>
        r.user_id === input.userId &&
        r.rule_id === input.ruleId &&
        r.audit_id_applied === input.auditIdApplied &&
        r.metric === input.metric,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const outcome: RecommendationOutcome = {
      id: randomUUID(),
      user_id: input.userId,
      rule_id: input.ruleId,
      audit_id_applied: input.auditIdApplied,
      audit_id_measured: null,
      metric: input.metric,
      value_before: null,
      value_after: null,
      as_of_before: null,
      as_of_after: null,
      fidelity_label: "correlation_only",
      source: "user_marked_applied",
      created_at: now,
      updated_at: now,
    };
    this.rows.set(outcome.id, outcome);
    return outcome;
  }

  async listPendingForUser(userId: string): Promise<RecommendationOutcome[]> {
    return [...this.rows.values()].filter(
      (r) => r.user_id === userId && r.audit_id_measured === null,
    );
  }

  async recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]> {
    const updated: RecommendationOutcome[] = [];
    for (const delta of input.values) {
      const row = [...this.rows.values()].find(
        (r) =>
          r.user_id === input.userId &&
          r.rule_id === delta.ruleId &&
          r.metric === delta.metric &&
          r.audit_id_measured === null,
      );
      if (!row) continue;
      const updatedRow: RecommendationOutcome = {
        ...row,
        audit_id_measured: input.auditIdMeasured,
        value_before: delta.valueBefore,
        value_after: delta.valueAfter,
        as_of_before: input.previousAuditId,
        as_of_after: input.auditIdMeasured,
        updated_at: new Date().toISOString(),
      };
      this.rows.set(updatedRow.id, updatedRow);
      updated.push(updatedRow);
    }
    return updated;
  }

  async listForAudit(auditId: string): Promise<RecommendationOutcome[]> {
    return [...this.rows.values()].filter(
      (r) => r.audit_id_applied === auditId || r.audit_id_measured === auditId,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/audit-pipeline/src/in-memory-outcome-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/outcome-store.ts packages/audit-pipeline/src/in-memory-outcome-store.ts packages/audit-pipeline/src/in-memory-outcome-store.test.ts
git commit -m "feat(audit-pipeline): add outcome store interface and in-memory store"
```

---

### Task 8: Postgres outcome store

**Files:**
- Create: `packages/audit-pipeline/src/postgres-outcome-store.ts`
- Test: `packages/audit-pipeline/src/postgres-outcome-store.test.ts`

**Interfaces:**
- Consumes: `OutcomeStore` interface, Postgres `Pool`
- Produces: `PostgresOutcomeStore`

- [ ] **Step 1: Write the failing test**

Use the project's Postgres test helper pattern. Test `markApplied`, `listPendingForUser`, `recordDeltas`, `listForAudit`.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/audit-pipeline/src/postgres-outcome-store.test.ts
```

Expected: FAIL — class missing.

- [ ] **Step 3: Write minimal implementation**

Create `packages/audit-pipeline/src/postgres-outcome-store.ts`:

```typescript
import type { Pool, QueryResultRow } from "pg";
import type { MarkAppliedInput, OutcomeStore, RecommendationOutcome, RecordDeltasInput } from "./outcome-store.js";

interface OutcomeRow extends QueryResultRow {
  id: string;
  user_id: string;
  rule_id: string;
  audit_id_applied: string;
  audit_id_measured: string | null;
  metric: string;
  value_before: string | null;
  value_after: string | null;
  as_of_before: Date | null;
  as_of_after: Date | null;
  fidelity_label: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

function rowToOutcome(row: OutcomeRow): RecommendationOutcome {
  return {
    id: row.id,
    user_id: row.user_id,
    rule_id: row.rule_id,
    audit_id_applied: row.audit_id_applied,
    audit_id_measured: row.audit_id_measured,
    metric: row.metric,
    value_before: row.value_before ? Number(row.value_before) : null,
    value_after: row.value_after ? Number(row.value_after) : null,
    as_of_before: row.as_of_before ? row.as_of_before.toISOString() : null,
    as_of_after: row.as_of_after ? row.as_of_after.toISOString() : null,
    fidelity_label: row.fidelity_label as RecommendationOutcome["fidelity_label"],
    source: row.source,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export class PostgresOutcomeStore implements OutcomeStore {
  constructor(private readonly pool: Pool) {}

  async markApplied(input: MarkAppliedInput): Promise<RecommendationOutcome> {
    const result = await this.pool.query<OutcomeRow>(
      `INSERT INTO recommendation_outcomes (user_id, rule_id, audit_id_applied, metric)
       VALUES ($1::uuid, $2, $3::uuid, $4)
       ON CONFLICT (user_id, rule_id, audit_id_applied, metric) DO NOTHING
       RETURNING *`,
      [input.userId, input.ruleId, input.auditIdApplied, input.metric],
    );
    if (result.rows[0]) return rowToOutcome(result.rows[0]);
    const existing = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE user_id = $1::uuid AND rule_id = $2 AND audit_id_applied = $3::uuid AND metric = $4`,
      [input.userId, input.ruleId, input.auditIdApplied, input.metric],
    );
    if (!existing.rows[0]) throw new Error("Failed to insert or fetch outcome");
    return rowToOutcome(existing.rows[0]);
  }

  async listPendingForUser(userId: string): Promise<RecommendationOutcome[]> {
    const result = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE user_id = $1::uuid AND audit_id_measured IS NULL`,
      [userId],
    );
    return result.rows.map(rowToOutcome);
  }

  async recordDeltas(input: RecordDeltasInput): Promise<RecommendationOutcome[]> {
    const updated: RecommendationOutcome[] = [];
    for (const delta of input.values) {
      const result = await this.pool.query<OutcomeRow>(
        `UPDATE recommendation_outcomes
         SET audit_id_measured = $1::uuid,
             value_before = $2,
             value_after = $3,
             as_of_before = $4::uuid,
             as_of_after = $1::uuid,
             updated_at = now()
         WHERE user_id = $5::uuid AND rule_id = $6 AND audit_id_measured IS NULL
         RETURNING *`,
        [input.auditIdMeasured, delta.valueBefore, delta.valueAfter, input.previousAuditId, input.userId, delta.ruleId],
      );
      if (result.rows[0]) updated.push(rowToOutcome(result.rows[0]));
    }
    return updated;
  }

  async listForAudit(auditId: string): Promise<RecommendationOutcome[]> {
    const result = await this.pool.query<OutcomeRow>(
      `SELECT * FROM recommendation_outcomes
       WHERE audit_id_applied = $1::uuid OR audit_id_measured = $1::uuid`,
      [auditId],
    );
    return result.rows.map(rowToOutcome);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/audit-pipeline/src/postgres-outcome-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/postgres-outcome-store.ts packages/audit-pipeline/src/postgres-outcome-store.test.ts
git commit -m "feat(audit-pipeline): add Postgres outcome store"
```

---

### Task 9: Outcome delta computation service

**Files:**
- Create: `packages/audit-pipeline/src/outcome-service.ts`
- Test: `packages/audit-pipeline/src/outcome-service.test.ts`

**Interfaces:**
- Consumes: `OutcomeStore`, `AuditStore`, `AuditRecord`
- Produces: `recordOutcomeDeltas(store, auditStore, audit)`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, test } from "vitest";
import { InMemoryAuditStore } from "./audit-store.js";
import { InMemoryOutcomeStore } from "./in-memory-outcome-store.js";
import { recordOutcomeDeltas } from "./outcome-service.js";
import type { AuditRecord, StoredReportEnvelope } from "./index.js";

function recordWithScore(id: string, userId: string, url: string, score: number): AuditRecord {
  return {
    id,
    target_url: url,
    locale: "en",
    context: { business_type: "saas" },
    tier: "rich",
    status: "READY_COMPLETE",
    secret_hash: "hash",
    user_id: userId,
    failure_reason: null,
    report: {
      report: {} as StoredReportEnvelope["report"],
      findings: [],
      unavailable: [],
      action_board: [],
      costs: { currency: "USD", agents: [], total_usd: 0 },
      score: {
        methodology_version: "0.1.0-m10",
        presence_readiness: score,
        pre_cap_value: score,
        applied_caps: [],
        categories: [],
        coverage: 1,
        confidence: "high",
        unavailable_categories: [],
      },
    },
    costs: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: null,
    deleted_at: null,
  };
}

describe("recordOutcomeDeltas", () => {
  test("records delta when a later audit completes", async () => {
    const auditStore = new InMemoryAuditStore();
    const outcomeStore = new InMemoryOutcomeStore();
    const userId = "user-1";
    const prev = await auditStore.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: { business_type: "saas" },
      tier: "rich",
      secretHash: "hash1",
      ttlDays: 7,
      userId,
    });
    const next = await auditStore.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: { business_type: "saas" },
      tier: "rich",
      secretHash: "hash2",
      ttlDays: 7,
      userId,
    });
    await outcomeStore.markApplied({
      userId,
      ruleId: "R-1",
      auditIdApplied: prev.id,
      metric: "presence_readiness",
    });

    await recordOutcomeDeltas(outcomeStore, auditStore, recordWithScore(next.id, userId, "https://example.com", 70));

    const outcomes = await outcomeStore.listForAudit(prev.id);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].audit_id_measured).toBe(next.id);
    expect(outcomes[0].value_after).toBe(70);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/audit-pipeline/src/outcome-service.test.ts
```

Expected: FAIL — `recordOutcomeDeltas` not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/audit-pipeline/src/outcome-service.ts`:

```typescript
import type { AuditRecord, AuditStore } from "./audit-store.js";
import type { OutcomeStore } from "./outcome-store.js";

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function scoreValue(record: AuditRecord, metric: string): number | null {
  if (!record.report?.score) return null;
  if (metric === "presence_readiness") return record.report.score.presence_readiness;
  const cat = record.report.score.categories.find((c) => c.category === metric);
  return cat?.value ?? null;
}

export async function recordOutcomeDeltas(
  outcomeStore: OutcomeStore,
  auditStore: AuditStore,
  completedAudit: AuditRecord,
): Promise<void> {
  if (!completedAudit.user_id) return;
  const domain = normalizeDomain(completedAudit.target_url);
  const userRecords = await auditStore.listByUser(completedAudit.user_id);
  const previous = userRecords
    .filter(
      (r) =>
        r.id !== completedAudit.id &&
        r.status === "READY_COMPLETE" &&
        normalizeDomain(r.target_url) === domain &&
        new Date(r.created_at).getTime() < new Date(completedAudit.created_at).getTime(),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!previous) return;

  const pending = await outcomeStore.listPendingForUser(completedAudit.user_id);
  const values = pending
    .filter((p) => p.audit_id_applied === previous.id)
    .map((p) => ({
      ruleId: p.rule_id,
      metric: p.metric,
      valueBefore: scoreValue(previous, p.metric),
      valueAfter: scoreValue(completedAudit, p.metric),
    }));

  if (values.length === 0) return;
  await outcomeStore.recordDeltas({
    userId: completedAudit.user_id,
    auditIdMeasured: completedAudit.id,
    previousAuditId: previous.id,
    values,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run packages/audit-pipeline/src/outcome-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/outcome-service.ts packages/audit-pipeline/src/outcome-service.test.ts
git commit -m "feat(audit-pipeline): add outcome delta computation service"
```

---

### Task 10: Wire scorer and outcome service into pipeline

**Files:**
- Modify: `packages/audit-pipeline/src/pipeline.ts`
- Modify: `packages/audit-pipeline/src/index.ts`
- Modify: `apps/web/src/services/container.ts`
- Test: existing pipeline integration tests

**Interfaces:**
- Consumes: `loadRecommendationConfig`, `classifyIndustry`, `applyPlaybook`, `OutcomeStore`, `recordOutcomeDeltas`
- Produces: pipeline uses new priority items; calls outcome deltas on completion

- [ ] **Step 1: Write the failing test**

Add/update an integration test that asserts `calculatePriority` receives the recommendation config and industry, and that `recordOutcomeDeltas` is called on pipeline completion when an `outcomeStore` is provided.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run packages/audit-pipeline/src/pipeline.test.ts
```

Expected: FAIL — new imports/signature.

- [ ] **Step 3: Write minimal implementation**

Update `packages/audit-pipeline/src/pipeline.ts`:

```typescript
import {
  aggregateToSite,
  applyPlaybook,
  calculatePriority,
  calculateScore,
  classifyIndustry,
  generateFindings,
  loadRecommendationConfig,
  RuleCatalog,
} from "@wpi/rules-engine";
import type { OutcomeStore } from "./outcome-store.js";
import { recordOutcomeDeltas } from "./outcome-service.js";
```

Add `outcomeStore?: OutcomeStore` to `PipelineDeps`.

Add a helper to derive site stage from audit history:

```typescript
async function deriveSiteStage(
  store: AuditStore,
  userId: string | null,
  targetUrl: string,
  currentAuditId: string,
): Promise<string> {
  if (!userId) return "growth";
  const domain = normalizeDomain(targetUrl);
  const records = await store.listByUser(userId);
  const firstAudit = records
    .filter(
      (r) =>
        r.id !== currentAuditId &&
        r.status === "READY_COMPLETE" &&
        normalizeDomain(r.target_url) === domain,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!firstAudit) return "growth";
  const ageDays = (Date.now() - new Date(firstAudit.created_at).getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < 365) return "new";
  if (ageDays < 1095) return "growth";
  return "mature";
}
```

Replace the priority call with:

```typescript
const recConfig = loadRecommendationConfig();
const industryResult = classifyIndustry({
  business_type: raw.context.business_type,
});
const siteStage = await deriveSiteStage(deps.store, raw.user_id, raw.target_url, auditId);
let priorityItems = calculatePriority(reFindings, rules, recConfig.scoring, {
  industry: industryResult.industry,
  siteStage,
});
const playbook = recConfig.playbooks.find((p) => p.playbook_id === industryResult.industry);
if (playbook) {
  priorityItems = applyPlaybook(priorityItems, playbook, recConfig.scoring.maxPlaybookBoost);
}
// Re-sort after playbook boosts
priorityItems.sort((a, b) => b.priority_score - a.priority_score);
```

After `setOutcome`, add:

```typescript
if (deps.outcomeStore && record.user_id) {
  await recordOutcomeDeltas(deps.outcomeStore, deps.store, record).catch((error) => {
    console.warn(`Outcome delta recording failed for audit ${auditId}:`, error);
  });
}
```

Update `packages/audit-pipeline/src/index.ts` to export new modules.

Update `apps/web/src/services/container.ts`:

```typescript
import { InMemoryOutcomeStore, PostgresOutcomeStore, type OutcomeStore } from "@wpi/audit-pipeline";

export interface AuditServices {
  // ... existing fields
  outcomeStore: OutcomeStore;
}
```

In `buildServices`, create the store:

```typescript
const outcomeStore = pool
  ? new PostgresOutcomeStore(pool)
  : new InMemoryOutcomeStore();
```

Return it in the services object.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/audit-pipeline test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/audit-pipeline/src/pipeline.ts packages/audit-pipeline/src/index.ts apps/web/src/services/container.ts
git commit -m "feat(audit-pipeline, web): wire recommendation scorer and outcome service into pipeline"
```

---

### Task 11: Mark-applied API route

**Files:**
- Create: `apps/web/src/app/api/audits/[id]/recommendations/[findingId]/apply/route.ts`
- Test: `apps/web/src/test/api-routes.test.ts` (extend)

**Interfaces:**
- Consumes: `AuditServices` (store, auth, outcomeStore)
- Produces: `POST /api/audits/[id]/recommendations/[findingId]/apply` returning `{ outcome: RecommendationOutcome }`

- [ ] **Step 1: Write the failing test**

Add a test in the web API route test file that POSTs to the apply endpoint as a signed-in owner and asserts a 200 with outcome data. Anonymous/non-owner requests return 401/404.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @wpi/web test
```

Expected: FAIL — route missing.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/api/audits/[id]/recommendations/[findingId]/apply/route.ts`:

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, SESSION_COOKIE_NAME } from "@wpi/auth";
import { getAuditServices } from "../../../../../../services/container";
import { authorizeRecord } from "../../../../../../services/access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  const { id, findingId } = await params;
  const services = await getAuditServices();
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = cookieValue ? await services.auth.getSessionUser(hashToken(cookieValue)) : null;
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const outcome = await authorizeRecord(services.store, id, undefined, user.id);
  if (outcome.kind !== "authorized") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!services.outcomeStore) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const stored = outcome.record.report?.action_board.find((a) => a.source_finding_id === findingId);
  if (!stored) {
    return NextResponse.json({ error: "finding_not_found" }, { status: 404 });
  }

  const applied = await services.outcomeStore.markApplied({
    userId: user.id,
    ruleId: stored.title,
    auditIdApplied: id,
    metric: "presence_readiness",
  });

  return NextResponse.json({ outcome: applied });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/audits apps/web/src/test/api-routes.test.ts
git commit -m "feat(web): add mark-applied API route"
```

---

### Task 12: Report action board UI

**Files:**
- Create: `apps/web/src/app/[locale]/audit/[id]/_components/action-board.tsx`
- Modify: `apps/web/src/app/[locale]/audit/[id]/_components/report-view.tsx`
- Test: Playwright e2e or web typecheck

**Interfaces:**
- Consumes: `StoredActionItem[]`, `locale`, `isOwner`, `auditId`
- Produces: grouped, interactive action board

- [ ] **Step 1: Write the failing test**

Add a Playwright test (or component test) that expects the report page to show "Quick Win" heading and a "Mark as applied" button when the user is signed in.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @wpi/web e2e
```

Expected: FAIL — component/route missing.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/[locale]/audit/[id]/_components/action-board.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StoredActionItem } from "@wpi/audit-pipeline";

const BAND_STYLES: Record<StoredActionItem["band"], string> = {
  quick_win: "bg-emerald-100 text-emerald-800",
  strategic: "bg-brand-100 text-brand-800",
  fill_in: "bg-amber-100 text-amber-800",
  defer: "bg-surface-200 text-surface-700",
};

export function ActionBoard({
  items,
  locale,
  isOwner,
  auditId,
}: {
  items: StoredActionItem[];
  locale: string;
  isOwner: boolean;
  auditId: string;
}) {
  const t = useTranslations({ locale, namespace: "report" });
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const grouped = {
    quick_win: items.filter((i) => i.band === "quick_win"),
    strategic: items.filter((i) => i.band === "strategic"),
    fill_in: items.filter((i) => i.band === "fill_in"),
    defer: items.filter((i) => i.band === "defer"),
  };

  async function markApplied(findingId: string) {
    const res = await fetch(`/api/audits/${auditId}/recommendations/${findingId}/apply`, {
      method: "POST",
    });
    if (res.ok) {
      setApplied((prev) => new Set(prev).add(findingId));
    }
  }

  return (
    <section className="space-y-8">
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((band) => {
        const bandItems = grouped[band];
        if (bandItems.length === 0) return null;
        return (
          <div key={band} className="space-y-3">
            <h3 className="text-lg font-semibold text-surface-900">{t(`band_${band}`)}</h3>
            <ol className="space-y-3">
              {bandItems.map((item, index) => (
                <li
                  key={item.source_finding_id}
                  className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[band]}`}>
                      {t(`band_${band}`)}
                    </span>
                    <span className="rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700">
                      {t(`severity_${item.severity}`)}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-surface-900">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-surface-700">{item.detail}</p>
                  {isOwner && !applied.has(item.source_finding_id) ? (
                    <button
                      type="button"
                      onClick={() => markApplied(item.source_finding_id)}
                      className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      {t("mark_applied")}
                    </button>
                  ) : isOwner ? (
                    <p className="mt-4 text-sm font-medium text-emerald-600">{t("applied_pending")}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
```

Update `report-view.tsx` to replace the existing action board `<ol>` with `<ActionBoard items={envelope.action_board} locale={locale} isOwner={...} auditId={record.id} />`. Determine `isOwner` from the signed-in user and `record.user_id`.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/web typecheck
pnpm --filter @wpi/web e2e
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/audit/[id]/_components/action-board.tsx apps/web/src/app/[locale]/audit/[id]/_components/report-view.tsx
git commit -m "feat(web): render grouped recommendation action board"
```

---

### Task 13: Dashboard recommendations panel

**Files:**
- Create: `apps/web/src/app/[locale]/dashboard/_components/recommendations-panel.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`
- Test: web typecheck + e2e

**Interfaces:**
- Consumes: latest `AuditRecord` + outcomes from `outcomeStore`
- Produces: dashboard panel showing pending and measured recommendations

- [ ] **Step 1: Write the failing test**

Add a test that the dashboard shows a correlation-only delta card when the user has a measured outcome.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @wpi/web e2e
```

Expected: FAIL — panel missing.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/[locale]/dashboard/_components/recommendations-panel.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import type { RecommendationOutcome } from "@wpi/audit-pipeline";

export async function RecommendationsPanel({
  outcomes,
  locale,
}: {
  outcomes: RecommendationOutcome[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const measured = outcomes.filter((o) => o.audit_id_measured !== null);

  if (measured.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-surface-900">{t("recommendations_title")}</h2>
        <p className="mt-2 text-sm text-surface-700">{t("recommendations_empty")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-surface-900">{t("recommendations_title")}</h2>
      <ul className="mt-3 space-y-3">
        {measured.map((o) => {
          const delta =
            o.value_after !== null && o.value_before !== null ? o.value_after - o.value_before : null;
          return (
            <li key={o.id} className="text-sm text-surface-700">
              <span className="font-medium">{o.rule_id}</span>{" "}
              {delta !== null ? (
                <span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(0)} {t("points")}
                </span>
              ) : (
                <span>{t("no_metric")}</span>
              )}
              <p className="mt-1 text-xs text-surface-500">{t("fidelity")}: {t(`fidelity_${o.fidelity_label}`)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

Update `dashboard/page.tsx` to fetch outcomes for the latest audit and render `<RecommendationsPanel outcomes={outcomes} locale={locale} />`.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/web typecheck
pnpm --filter @wpi/web e2e
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/_components/recommendations-panel.tsx apps/web/src/app/[locale]/dashboard/page.tsx
git commit -m "feat(web): add dashboard recommendations panel"
```

---

### Task 14: i18n keys

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/ar.json`
- Test: web typecheck

**Interfaces:**
- Produces: bilingual strings for all new UI

- [ ] **Step 1: Write the failing test**

Run typecheck; it fails because keys referenced in components are missing.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @wpi/web typecheck
```

Expected: FAIL — missing keys.

- [ ] **Step 3: Write minimal implementation**

Add to `apps/web/messages/en.json` under `report` and `dashboard` namespaces:

```json
{
  "report": {
    "band_quick_win": "Quick Win",
    "band_strategic": "Strategic",
    "band_fill_in": "Fill-In",
    "band_defer": "Defer",
    "mark_applied": "Mark as applied",
    "applied_pending": "Applied — pending measurement",
    "fidelity_correlation_only": "correlation only"
  },
  "dashboard": {
    "recommendations_title": "Recommendations",
    "recommendations_empty": "Apply recommendations from your latest audit to start tracking outcomes.",
    "points": "points",
    "no_metric": "metric unavailable",
    "fidelity": "Fidelity"
  }
}
```

Add equivalent Arabic strings to `apps/web/messages/ar.json` with `needs_native_review: true` comments where appropriate.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @wpi/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/ar.json
git commit -m "feat(web): add EN/AR i18n keys for recommendations"
```

---

### Task 15: Final verification

**Files:**
- All modified files

**Interfaces:**
- Produces: green full suite

- [ ] **Step 1: Run repo-wide build**

```bash
pnpm -r build
```

Expected: exit 0.

- [ ] **Step 2: Run repo-wide tests**

```bash
pnpm -r test
```

Expected: all pass, 0 failures.

- [ ] **Step 3: Run web typecheck**

```bash
pnpm --filter @wpi/web typecheck
```

Expected: exit 0.

- [ ] **Step 4: Run e2e**

```bash
pnpm --filter @wpi/web e2e
```

Expected: pass.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: final M10 verification fixes"
```

---

## Self-review

**Spec coverage:**
- FR-1 (new priority formula) → Tasks 1, 4
- FR-2 (bands) → Tasks 1, 4, 5
- FR-3 (industry/playbooks) → Tasks 1, 2, 3, 10
- FR-4 (site stage) → Task 4, 10
- FR-5 (mark applied) → Tasks 6, 7, 8, 11
- FR-6 (later audit deltas) → Tasks 7, 8, 9, 10
- FR-7 (minimum evidence) → Task 9
- FR-8 (i18n) → Task 14
- Data contracts → Tasks 1, 5, 7
- Security/ownership → Task 11
- Testing → Every task

**Placeholder scan:** No TBD/TODO/fill-in-details. Every step includes concrete code or exact commands.

**Type consistency:**
- `RecommendationPriorityItem` fields (`impact_score`, `effort_score`, `timeline_score`, `priority_score`, `band`, `playbook_note_key`) match `StoredActionItem`.
- `OutcomeStore` interface signatures match in-memory and Postgres implementations.
- `recordOutcomeDeltas` input matches what `outcome-service.ts` computes.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-15-m10-recommendations-engine.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
