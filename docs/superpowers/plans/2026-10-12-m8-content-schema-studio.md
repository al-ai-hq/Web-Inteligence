# M8 Content and Schema Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the content brief/draft workflow, schema builder, fact manifests, and approval system for bilingual content creation with risk-tiered approvals.

**Architecture:** Five focused packages (content-briefs, content-drafts, schema-builder, fact-manifests, content-approvals) with database migrations 0009-0015, agent tool integrations, API routes in apps/web, and bilingual UI components. Content flows from opportunity → brief → draft → schema → approval → CMS draft (human publishes).

**Tech Stack:** TypeScript 5.6 (verbatimModuleSyntax: true), pnpm 9.12.0 workspaces, vitest 2.1.0, PostgreSQL (pg 8.13.0), Zod 3.23.8, next-intl for i18n, Next.js 15 App Router

**Spec:** docs/superpowers/specs/2026-10-12-m8-content-schema-studio-design.md

## Global Constraints

- TypeScript 5.6 with `verbatimModuleSyntax: true` — all imports/exports must use `import type` for type-only imports
- ESM modules only — all packages use `"type": "module"`
- Node.js 22+ — `engines.node` in all package.json files
- pnpm 9.12.0 workspaces — all new packages under `packages/` with `@wpi/` scope
- vitest 2.1.0 for testing — all tests use `vitest`
- PostgreSQL 15+ — migrations use `gen_random_uuid()`, `timestamptz`, `jsonb`
- Bilingual support — all UI strings in `apps/web/src/messages/{en,ar}.json`
- Risk tiers enforced — Tier 1 (1 approver), Tier 2 (1 approver + diff), Tier 3 (2 approvers, requester excluded, change window)
- Forbidden patterns blocked — hidden text, cloaking, link schemes, keyword stuffing, fabricated reviews
- Arabic keyword normalization — normalize diacritics for matching, preserve original for display
- Draft rate limit — max 8 new-article drafts per project per month
- No automatic publishing — system creates CMS drafts or PRs, human publishes

## File Structure

### Migrations (in `packages/audit-pipeline/src/migrations/`)
- `0009_create_content_briefs.sql` — content briefs table
- `0010_create_content_drafts.sql` — content drafts table
- `0011_create_draft_rate_limits.sql` — draft rate limiting table
- `0012_create_schema_objects.sql` — schema markup storage
- `0013_create_fact_manifests.sql` — fact manifests and facts tables
- `0014_create_change_sets.sql` — change sets and approval records
- `0015_create_change_windows.sql` — change windows for Tier 3

### Package 1: `@wpi/content-briefs`
```
packages/content-briefs/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── brief-store.ts
│   ├── cannibalization.ts
│   ├── draft-rate.ts
│   ├── outline-generator.ts
│   └── arabic-normalizer.ts
└── tests/
    ├── brief-store.test.ts
    ├── cannibalization.test.ts
    ├── draft-rate.test.ts
    └── arabic-normalizer.test.ts
```

### Package 2: `@wpi/content-drafts`
```
packages/content-drafts/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── draft-store.ts
│   ├── draft-gates.ts
│   ├── metadata-generator.ts
│   └── internal-linker.ts
└── tests/
    ├── draft-store.test.ts
    ├── draft-gates.test.ts
    └── metadata-generator.test.ts
```

### Package 3: `@wpi/schema-builder`
```
packages/schema-builder/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── builder.ts
│   ├── validator.ts
│   ├── diff-engine.ts
│   └── recommender.ts
└── tests/
    ├── builder.test.ts
    ├── validator.test.ts
    ├── diff-engine.test.ts
    └── recommender.test.ts
```

### Package 4: `@wpi/fact-manifests`
```
packages/fact-manifests/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── manifest-store.ts
│   ├── regulated-claims.ts
│   └── citation-tracker.ts
└── tests/
    ├── manifest-store.test.ts
    ├── regulated-claims.test.ts
    └── citation-tracker.test.ts
```

### Package 5: `@wpi/content-approvals`
```
packages/content-approvals/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── approval-store.ts
│   ├── state-machine.ts
│   ├── risk-tiers.ts
│   ├── validation-rules.ts
│   ├── forbidden-detector.ts
│   └── change-window.ts
└── tests/
    ├── approval-store.test.ts
    ├── state-machine.test.ts
    ├── risk-tiers.test.ts
    ├── validation-rules.test.ts
    ├── forbidden-detector.test.ts
    └── change-window.test.ts
```

### Agent Tools (in `services/agents/src/tools/`)
- Enhance `write-brief.ts` to use `@wpi/content-briefs`
- New: `create-draft.ts` using `@wpi/content-drafts`
- New: `build-schema.ts` using `@wpi/schema-builder`
- New: `manage-facts.ts` using `@wpi/fact-manifests`
- New: `request-approval.ts` using `@wpi/content-approvals`

### API Routes (in `apps/web/src/app/[locale]/api/`)
- `briefs/route.ts` — GET/POST briefs
- `briefs/[id]/route.ts` — GET/PUT/PATCH brief
- `briefs/[id]/approve/route.ts` — POST approve brief
- `drafts/route.ts` — GET/POST drafts
- `drafts/[id]/route.ts` — GET/PUT draft
- `drafts/[id]/approve/route.ts` — POST approve draft
- `schema/route.ts` — GET/POST schema objects
- `schema/[id]/route.ts` — GET/PUT schema
- `schema/validate/route.ts` — POST validate schema
- `fact-manifests/route.ts` — GET/POST manifests
- `fact-manifests/[id]/route.ts` — GET/PUT manifest
- `change-sets/route.ts` — GET/POST change sets
- `change-sets/[id]/route.ts` — GET change set
- `change-sets/[id]/approve/route.ts` — POST approve change set
- `change-windows/route.ts` — GET/POST change windows

### UI Components (in `apps/web/src/app/[locale]/(studio)/projects/[projectId]/`)
- `briefs/page.tsx` — briefs list page
- `briefs/_components/brief-list.tsx` — brief list component
- `briefs/_components/brief-form.tsx` — brief create/edit form
- `briefs/[id]/page.tsx` — brief detail page
- `briefs/[id]/_components/brief-view.tsx` — brief view component
- `drafts/page.tsx` — drafts list page
- `drafts/_components/draft-list.tsx` — draft list component
- `drafts/_components/draft-form.tsx` — draft create/edit form
- `drafts/[id]/page.tsx` — draft detail page
- `drafts/[id]/_components/draft-view.tsx` — draft view component
- `schema/page.tsx` — schema builder page
- `schema/_components/schema-form.tsx` — schema builder form
- `schema/_components/schema-preview.tsx` — JSON-LD preview
- `approvals/page.tsx` — approvals dashboard
- `approvals/_components/approval-list.tsx` — pending approvals list
- `approvals/[id]/_components/approval-review.tsx` — approval review component

---

### Task 1: Database Migrations (0009-0015)

**Files:**
- Create: `packages/audit-pipeline/src/migrations/0009_create_content_briefs.sql`
- Create: `packages/audit-pipeline/src/migrations/0010_create_content_drafts.sql`
- Create: `packages/audit-pipeline/src/migrations/0011_create_draft_rate_limits.sql`
- Create: `packages/audit-pipeline/src/migrations/0012_create_schema_objects.sql`
- Create: `packages/audit-pipeline/src/migrations/0013_create_fact_manifests.sql`
- Create: `packages/audit-pipeline/src/migrations/0014_create_change_sets.sql`
- Create: `packages/audit-pipeline/src/migrations/0015_create_change_windows.sql`

**Interfaces:**
- Consumes: None (foundational migrations)
- Produces: Database schema for all M8 tables

- [ ] **Step 1: Write migration 0009 — content_briefs**

```sql
CREATE TABLE IF NOT EXISTS content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  audit_id uuid,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('unmapped_cluster', 'low_ctr', 'visibility_gap', 'aeo_failure')),
  opportunity_ref text NOT NULL,
  
  page_goal text NOT NULL,
  audience text NOT NULL,
  target_action text NOT NULL,
  target_url text,
  proposed_slug text,
  
  primary_keyword text NOT NULL,
  keyword_variants jsonb NOT NULL DEFAULT '[]',
  intent text NOT NULL CHECK (intent IN ('informational', 'navigational', 'commercial', 'transactional')),
  market text NOT NULL,
  volume integer,
  volume_source text,
  position double precision,
  position_source text,
  
  observations jsonb NOT NULL DEFAULT '[]',
  recommended_angle text NOT NULL,
  outlines jsonb NOT NULL DEFAULT '[]',
  questions jsonb NOT NULL DEFAULT '[]',
  entities jsonb NOT NULL DEFAULT '[]',
  terms jsonb NOT NULL DEFAULT '[]',
  titles jsonb NOT NULL DEFAULT '[]',
  meta_descriptions jsonb NOT NULL DEFAULT '[]',
  
  fact_sheet_ids jsonb NOT NULL DEFAULT '[]',
  inputs_needed jsonb NOT NULL DEFAULT '[]',
  internal_links jsonb NOT NULL DEFAULT '[]',
  schema_types jsonb NOT NULL DEFAULT '[]',
  length_guidance jsonb NOT NULL,
  
  cta text NOT NULL,
  conversion_notes text NOT NULL,
  regulated_topic text CHECK (regulated_topic IN ('health', 'finance', 'legal', null)),
  
  success_measures jsonb NOT NULL DEFAULT '[]',
  review_date date NOT NULL,
  
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_briefs_project ON content_briefs(project_id);
CREATE INDEX idx_content_briefs_status ON content_briefs(status);
CREATE INDEX idx_content_briefs_opportunity ON content_briefs(opportunity_type, opportunity_ref);
```

- [ ] **Step 2: Write migration 0010 — content_drafts**

```sql
CREATE TABLE IF NOT EXISTS content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES content_briefs(id),
  project_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('drafting', 'review', 'approved', 'published')),
  
  author text NOT NULL,
  ai_assisted boolean NOT NULL DEFAULT false,
  ai_disclosure text,
  
  client_input_received boolean NOT NULL DEFAULT false,
  client_input_notes text,
  
  content jsonb NOT NULL DEFAULT '[]',
  facts_used jsonb NOT NULL DEFAULT '[]',
  internal_links jsonb NOT NULL DEFAULT '[]',
  schema_json_ld jsonb,
  
  word_count jsonb NOT NULL,
  reading_time_minutes jsonb NOT NULL,
  
  arabic_reviewer text,
  arabic_review_date date,
  arabic_review_notes text,
  
  cms_draft_url text,
  cms_pr_url text,
  published_url text,
  published_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_updated_content_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_drafts_brief ON content_drafts(brief_id);
CREATE INDEX idx_content_drafts_project ON content_drafts(project_id);
CREATE INDEX idx_content_drafts_status ON content_drafts(status);
```

- [ ] **Step 3: Write migration 0011 — draft_rate_limits**

```sql
CREATE TABLE IF NOT EXISTS draft_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  month_start date NOT NULL,
  draft_count integer NOT NULL DEFAULT 0,
  UNIQUE(project_id, month_start)
);

CREATE INDEX idx_draft_rate_limits_project_month ON draft_rate_limits(project_id, month_start);
```

- [ ] **Step 4: Write migration 0012 — schema_objects**

```sql
CREATE TABLE IF NOT EXISTS schema_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  page_url text NOT NULL,
  schema_type text NOT NULL,
  json_ld jsonb NOT NULL,
  html_snippet text NOT NULL,
  source text NOT NULL CHECK (source IN ('audit', 'brief', 'manual')),
  status text NOT NULL CHECK (status IN ('proposed', 'approved', 'applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schema_objects_project ON schema_objects(project_id);
CREATE INDEX idx_schema_objects_page ON schema_objects(page_url);
CREATE INDEX idx_schema_objects_type ON schema_objects(schema_type);
```

- [ ] **Step 5: Write migration 0013 — fact_manifests**

```sql
CREATE TABLE IF NOT EXISTS fact_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  fact_sheet_id uuid NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_manifest_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_manifest_id uuid NOT NULL REFERENCES fact_manifests(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('product', 'service', 'pricing', 'credential', 'result', 'review', 'policy')),
  statement text NOT NULL,
  evidence jsonb NOT NULL,
  regulated boolean NOT NULL DEFAULT false,
  regulated_topic text CHECK (regulated_topic IN ('health', 'finance', 'legal', null)),
  requires_professional_review boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_manifest_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL REFERENCES fact_manifest_facts(id) ON DELETE CASCADE,
  draft_id uuid,
  citation_text text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fact_manifests_project ON fact_manifests(project_id);
CREATE INDEX idx_fact_manifest_facts_manifest ON fact_manifest_facts(fact_manifest_id);
CREATE INDEX idx_fact_manifest_citations_fact ON fact_manifest_citations(fact_id);
CREATE INDEX idx_fact_manifest_citations_draft ON fact_manifest_citations(draft_id);
```

- [ ] **Step 6: Write migration 0014 — change_sets**

```sql
CREATE TABLE IF NOT EXISTS change_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  description text NOT NULL,
  risk_tier integer NOT NULL CHECK (risk_tier IN (1, 2, 3)),
  status text NOT NULL CHECK (status IN ('draft', 'validated', 'previewed', 'approved', 'rejected')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id uuid NOT NULL REFERENCES change_sets(id),
  risk_tier integer NOT NULL,
  approvers jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_sets_project ON change_sets(project_id);
CREATE INDEX idx_change_sets_status ON change_sets(status);
CREATE INDEX idx_change_set_items_change_set ON change_set_items(change_set_id);
CREATE INDEX idx_approval_records_change_set ON approval_records(change_set_id);
CREATE INDEX idx_approval_records_status ON approval_records(status);
```

- [ ] **Step 7: Write migration 0015 — change_windows**

```sql
CREATE TABLE IF NOT EXISTS change_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_windows_project ON change_windows(project_id);
```

- [ ] **Step 8: Commit migrations**

```bash
git add packages/audit-pipeline/src/migrations/0009_*.sql
git add packages/audit-pipeline/src/migrations/0010_*.sql
git add packages/audit-pipeline/src/migrations/0011_*.sql
git add packages/audit-pipeline/src/migrations/0012_*.sql
git add packages/audit-pipeline/src/migrations/0013_*.sql
git add packages/audit-pipeline/src/migrations/0014_*.sql
git add packages/audit-pipeline/src/migrations/0015_*.sql
git commit -m "feat: add M8 database migrations 0009-0015"
```

---

### Task 2: @wpi/content-briefs Package Scaffolding

**Files:**
- Create: `packages/content-briefs/package.json`
- Create: `packages/content-briefs/tsconfig.json`
- Create: `packages/content-briefs/src/types.ts`
- Create: `packages/content-briefs/src/index.ts`

**Interfaces:**
- Consumes: None
- Produces: Package structure, ContentBrief type, exports

- [ ] **Step 1: Write failing test — package exports**

Create `packages/content-briefs/tests/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as contentBriefs from '../src/index.js';

describe('@wpi/content-briefs', () => {
  it('exports ContentBrief type', () => {
    expect(contentBriefs).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/content-briefs && pnpm test`
Expected: FAIL — module not found or empty

- [ ] **Step 3: Create package.json**

```json
{
  "name": "@wpi/content-briefs",
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
    "pg": "^8.13.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 5: Define ContentBrief type**

Create `packages/content-briefs/src/types.ts`:

```typescript
import { z } from 'zod';

export const ContentBriefSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  audit_id: z.string().uuid().nullable(),
  status: z.enum(['draft', 'approved', 'rejected']),
  
  opportunity_type: z.enum(['unmapped_cluster', 'low_ctr', 'visibility_gap', 'aeo_failure']),
  opportunity_ref: z.string(),
  
  page_goal: z.string(),
  audience: z.string(),
  target_action: z.string(),
  target_url: z.string().url().nullable(),
  proposed_slug: z.string().nullable(),
  
  primary_keyword: z.string(),
  keyword_variants: z.array(z.object({
    keyword: z.string(),
    language: z.enum(['ar', 'en']),
    normalized: z.string().optional()
  })),
  intent: z.enum(['informational', 'navigational', 'commercial', 'transactional']),
  market: z.string(),
  volume: z.number().int().nullable(),
  volume_source: z.string().nullable(),
  position: z.number().nullable(),
  position_source: z.string().nullable(),
  
  observations: z.array(z.object({
    date: z.string(),
    source: z.enum(['serp', 'ai_citation', 'manual']),
    urls_examined: z.array(z.string()),
    notes: z.string()
  })),
  recommended_angle: z.string(),
  
  outlines: z.array(z.object({
    language: z.enum(['ar', 'en']),
    headings: z.array(z.object({
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string(),
      notes: z.string().optional()
    }))
  })),
  
  questions: z.array(z.object({
    question: z.string(),
    source: z.enum(['search_console', 'upload', 'visibility_prompt', 'manual'])
  })),
  
  entities: z.array(z.string()),
  terms: z.array(z.string()),
  
  titles: z.array(z.object({
    language: z.enum(['ar', 'en']),
    text: z.string()
  })),
  meta_descriptions: z.array(z.object({
    language: z.enum(['ar', 'en']),
    text: z.string()
  })),
  
  fact_sheet_ids: z.array(z.string().uuid()),
  inputs_needed: z.array(z.string()),
  internal_links: z.array(z.object({
    url: z.string(),
    anchor: z.string(),
    reason: z.string()
  })),
  schema_types: z.array(z.string()),
  
  length_guidance: z.object({
    min_words: z.number().int(),
    max_words: z.number().int(),
    basis: z.string()
  }),
  
  cta: z.string(),
  conversion_notes: z.string(),
  regulated_topic: z.enum(['health', 'finance', 'legal']).nullable(),
  
  success_measures: z.array(z.object({
    metric: z.enum(['impressions', 'clicks', 'average_position', 'panel_retest']),
    target: z.string()
  })),
  review_date: z.string(),
  
  created_by: z.string(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
```

- [ ] **Step 6: Create index.ts with exports**

```typescript
export { ContentBriefSchema, type ContentBrief } from './types.js';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/content-briefs && pnpm test`
Expected: PASS — 1 test

- [ ] **Step 8: Build and commit**

```bash
cd packages/content-briefs && pnpm build
git add packages/content-briefs/
git commit -m "feat: scaffold @wpi/content-briefs package"
```

---

### Task 3: @wpi/content-briefs — Arabic Normalizer, Cannibalization, Rate Limit

**Files:**
- Create: `packages/content-briefs/src/arabic-normalizer.ts`
- Create: `packages/content-briefs/src/cannibalization.ts`
- Create: `packages/content-briefs/src/draft-rate.ts`
- Create: `packages/content-briefs/tests/arabic-normalizer.test.ts`
- Create: `packages/content-briefs/tests/cannibalization.test.ts`
- Create: `packages/content-briefs/tests/draft-rate.test.ts`
- Modify: `packages/content-briefs/src/index.ts`

**Interfaces:**
- Consumes: ContentBrief type (Task 2)
- Produces: normalizeArabicKeyword, checkCannibalization, checkDraftRate functions

- [ ] **Step 1: Write failing test — Arabic normalizer**

Create `packages/content-briefs/tests/arabic-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeArabicKeyword, processKeywordVariants } from '../src/arabic-normalizer.js';

describe('normalizeArabicKeyword', () => {
  it('normalizes alef variants to bare alef', () => {
    expect(normalizeArabicKeyword('إسلام')).toBe('اسلام');
    expect(normalizeArabicKeyword('أحمد')).toBe('احمد');
    expect(normalizeArabicKeyword('آلة')).toBe('اله');
  });

  it('normalizes taa marbuta to haa', () => {
    expect(normalizeArabicKeyword('مدينة')).toBe('مدينه');
  });

  it('normalizes alef maqsura to yaa', () => {
    expect(normalizeArabicKeyword('على')).toBe('علي');
  });

  it('normalizes hamza variants to waw', () => {
    expect(normalizeArabicKeyword('سؤال')).toBe('سوال');
    expect(normalizeArabicKeyword('لائحة')).toBe('لاحه');
  });

  it('removes diacritics (tashkeel)', () => {
    expect(normalizeArabicKeyword('مُحَمَّد')).toBe('محمد');
  });

  it('handles combined normalizations', () => {
    expect(normalizeArabicKeyword('إِسْلَامِيَّة')).toBe('اسلاميه');
  });

  it('leaves English keywords unchanged', () => {
    expect(normalizeArabicKeyword('SEO')).toBe('SEO');
  });
});

describe('processKeywordVariants', () => {
  it('adds normalized form for Arabic keywords', () => {
    const variants = [{ keyword: 'مدينة', language: 'ar' as const }];
    const result = processKeywordVariants(variants);
    expect(result[0]!.normalized).toBe('مدينه');
  });

  it('does not normalize English keywords', () => {
    const variants = [{ keyword: 'SEO', language: 'en' as const }];
    const result = processKeywordVariants(variants);
    expect(result[0]!.normalized).toBe('SEO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/content-briefs && pnpm test tests/arabic-normalizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Arabic normalizer**

Create `packages/content-briefs/src/arabic-normalizer.ts`:

```typescript
export function normalizeArabicKeyword(keyword: string): string {
  return keyword
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'و')
    .replace(/[\u064B-\u065F]/g, '');
}

export function processKeywordVariants(
  variants: { keyword: string; language: 'ar' | 'en' }[]
): { keyword: string; language: 'ar' | 'en'; normalized: string }[] {
  return variants.map(v => ({
    ...v,
    normalized: v.language === 'ar' ? normalizeArabicKeyword(v.keyword) : v.keyword,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/content-briefs && pnpm test tests/arabic-normalizer.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Write failing test — cannibalization check**

Create `packages/content-briefs/tests/cannibalization.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkCannibalization } from '../src/cannibalization.js';

describe('checkCannibalization', () => {
  it('allows new page when cluster is not mapped', () => {
    const mappings = new Map<string, string>();
    const result = checkCannibalization('cluster-1', null, mappings);
    expect(result.ok).toBe(true);
  });

  it('rejects new page when cluster is already mapped', () => {
    const mappings = new Map<string, string>([['cluster-1', '/existing-page']]);
    const result = checkCannibalization('cluster-1', null, mappings);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cluster-1');
    expect(result.error).toContain('/existing-page');
  });

  it('allows existing page improvement even when cluster is mapped', () => {
    const mappings = new Map<string, string>([['cluster-1', '/existing-page']]);
    const result = checkCannibalization('cluster-1', '/existing-page', mappings);
    expect(result.ok).toBe(true);
  });

  it('allows new page for different cluster', () => {
    const mappings = new Map<string, string>([['cluster-1', '/page-1']]);
    const result = checkCannibalization('cluster-2', null, mappings);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/content-briefs && pnpm test tests/cannibalization.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement cannibalization check**

Create `packages/content-briefs/src/cannibalization.ts`:

```typescript
export function checkCannibalization(
  clusterId: string,
  targetUrl: string | null,
  existingMappings: Map<string, string>
): { ok: boolean; error?: string } {
  if (targetUrl !== null) {
    return { ok: true };
  }

  const existingUrl = existingMappings.get(clusterId);
  if (existingUrl) {
    return {
      ok: false,
      error: `Cluster ${clusterId} is already mapped to ${existingUrl}. Improve that page instead of creating a new one.`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/content-briefs && pnpm test tests/cannibalization.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 9: Write failing test — draft rate limit**

Create `packages/content-briefs/tests/draft-rate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkDraftRate } from '../src/draft-rate.js';

describe('checkDraftRate', () => {
  it('allows drafts under the limit', () => {
    const result = checkDraftRate('project-1', new Date('2026-10-01'), 5);
    expect(result.ok).toBe(true);
  });

  it('allows exactly 7 drafts (one below limit)', () => {
    const result = checkDraftRate('project-1', new Date('2026-10-01'), 7);
    expect(result.ok).toBe(true);
  });

  it('rejects when limit reached (8 drafts)', () => {
    const result = checkDraftRate('project-1', new Date('2026-10-01'), 8);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('8 drafts');
  });

  it('rejects when over limit', () => {
    const result = checkDraftRate('project-1', new Date('2026-10-01'), 10);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/content-briefs && pnpm test tests/draft-rate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 11: Implement draft rate check**

Create `packages/content-briefs/src/draft-rate.ts`:

```typescript
const MAX_DRAFTS_PER_MONTH = 8;

export function checkDraftRate(
  projectId: string,
  monthStart: Date,
  currentCount: number
): { ok: boolean; error?: string } {
  if (currentCount >= MAX_DRAFTS_PER_MONTH) {
    return {
      ok: false,
      error: `Project ${projectId} has reached the monthly limit of ${MAX_DRAFTS_PER_MONTH} drafts. Wait until next month or request an exception.`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/content-briefs && pnpm test tests/draft-rate.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 13: Update index.ts exports**

Modify `packages/content-briefs/src/index.ts`:

```typescript
export { ContentBriefSchema, type ContentBrief } from './types.js';
export { normalizeArabicKeyword, processKeywordVariants } from './arabic-normalizer.js';
export { checkCannibalization } from './cannibalization.js';
export { checkDraftRate } from './draft-rate.js';
```

- [ ] **Step 14: Run all tests and build**

```bash
cd packages/content-briefs && pnpm test && pnpm build
```

Expected: All 18 tests pass, build succeeds

- [ ] **Step 15: Commit**

```bash
git add packages/content-briefs/
git commit -m "feat: add Arabic normalizer, cannibalization check, draft rate limit to @wpi/content-briefs"
```

---

### Task 4: @wpi/content-briefs — Brief Store (Postgres CRUD)

**Files:**
- Create: `packages/content-briefs/src/brief-store.ts`
- Create: `packages/content-briefs/tests/brief-store.test.ts`
- Modify: `packages/content-briefs/src/index.ts`

**Interfaces:**
- Consumes: ContentBrief type, database migrations (Task 1)
- Produces: BriefStore interface, PostgresBriefStore implementation

- [ ] **Step 1: Write failing test — brief store CRUD**

Create `packages/content-briefs/tests/brief-store.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PostgresBriefStore } from '../src/brief-store.js';
import type { ContentBrief } from '../src/types.js';

describe('PostgresBriefStore', () => {
  let pool: Pool;
  let store: PostgresBriefStore;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/wpi_test' });
    store = new PostgresBriefStore(pool);
    await pool.query('DELETE FROM content_briefs');
  });

  afterAll(async () => {
    await pool.end();
  });

  const sampleBrief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'> = {
    project_id: '00000000-0000-0000-0000-000000000001',
    audit_id: null,
    status: 'draft',
    opportunity_type: 'unmapped_cluster',
    opportunity_ref: 'cluster-1',
    page_goal: 'Inform users',
    audience: 'Developers',
    target_action: 'Read article',
    target_url: null,
    proposed_slug: 'test-article',
    primary_keyword: 'test',
    keyword_variants: [{ keyword: 'test', language: 'en', normalized: 'test' }],
    intent: 'informational',
    market: 'SA',
    volume: 100,
    volume_source: 'gsc',
    position: 5.2,
    position_source: 'gsc',
    observations: [],
    recommended_angle: 'Test angle',
    outlines: [{ language: 'en', headings: [{ level: 1, text: 'Test' }] }],
    questions: [],
    entities: [],
    terms: [],
    titles: [{ language: 'en', text: 'Test Title' }],
    meta_descriptions: [{ language: 'en', text: 'Test description' }],
    fact_sheet_ids: [],
    inputs_needed: [],
    internal_links: [],
    schema_types: [],
    length_guidance: { min_words: 500, max_words: 1000, basis: 'test' },
    cta: 'Learn more',
    conversion_notes: 'Notes',
    regulated_topic: null,
    success_measures: [],
    review_date: '2026-11-01',
    created_by: 'test@example.com',
    approved_by: null,
    approved_at: null,
  };

  it('creates a brief and returns it with id', async () => {
    const brief = await store.create(sampleBrief);
    expect(brief.id).toBeDefined();
    expect(brief.status).toBe('draft');
    expect(brief.created_at).toBeDefined();
  });

  it('retrieves a brief by id', async () => {
    const created = await store.create(sampleBrief);
    const retrieved = await store.getById(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.primary_keyword).toBe('test');
  });

  it('updates a brief', async () => {
    const created = await store.create(sampleBrief);
    const updated = await store.update(created.id, { status: 'approved', approved_by: 'admin@example.com' });
    expect(updated.status).toBe('approved');
    expect(updated.approved_by).toBe('admin@example.com');
  });

  it('lists briefs by project_id', async () => {
    const projectId = '00000000-0000-0000-0000-000000000002';
    await store.create({ ...sampleBrief, project_id: projectId });
    await store.create({ ...sampleBrief, project_id: projectId });
    const briefs = await store.listByProject(projectId);
    expect(briefs.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/content-briefs && pnpm test tests/brief-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PostgresBriefStore**

Create `packages/content-briefs/src/brief-store.ts`:

```typescript
import type { Pool } from 'pg';
import type { ContentBrief } from './types.js';
import { ContentBriefSchema } from './types.js';

export interface BriefStore {
  create(brief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'>): Promise<ContentBrief>;
  getById(id: string): Promise<ContentBrief | null>;
  update(id: string, updates: Partial<ContentBrief>): Promise<ContentBrief>;
  listByProject(projectId: string): Promise<ContentBrief[]>;
}

export class PostgresBriefStore implements BriefStore {
  constructor(private pool: Pool) {}

  async create(brief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'>): Promise<ContentBrief> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO content_briefs (
        project_id, audit_id, status, opportunity_type, opportunity_ref,
        page_goal, audience, target_action, target_url, proposed_slug,
        primary_keyword, keyword_variants, intent, market, volume, volume_source,
        position, position_source, observations, recommended_angle, outlines,
        questions, entities, terms, titles, meta_descriptions, fact_sheet_ids,
        inputs_needed, internal_links, schema_types, length_guidance, cta,
        conversion_notes, regulated_topic, success_measures, review_date,
        created_by, approved_by, approved_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41)
      RETURNING *`,
      [
        brief.project_id, brief.audit_id, brief.status, brief.opportunity_type, brief.opportunity_ref,
        brief.page_goal, brief.audience, brief.target_action, brief.target_url, brief.proposed_slug,
        brief.primary_keyword, JSON.stringify(brief.keyword_variants), brief.intent, brief.market,
        brief.volume, brief.volume_source, brief.position, brief.position_source,
        JSON.stringify(brief.observations), brief.recommended_angle, JSON.stringify(brief.outlines),
        JSON.stringify(brief.questions), JSON.stringify(brief.entities), JSON.stringify(brief.terms),
        JSON.stringify(brief.titles), JSON.stringify(brief.meta_descriptions),
        JSON.stringify(brief.fact_sheet_ids), JSON.stringify(brief.inputs_needed),
        JSON.stringify(brief.internal_links), JSON.stringify(brief.schema_types),
        JSON.stringify(brief.length_guidance), brief.cta, brief.conversion_notes,
        brief.regulated_topic, JSON.stringify(brief.success_measures), brief.review_date,
        brief.created_by, brief.approved_by, brief.approved_at, now, now,
      ]
    );
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async getById(id: string): Promise<ContentBrief | null> {
    const result = await this.pool.query('SELECT * FROM content_briefs WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async update(id: string, updates: Partial<ContentBrief>): Promise<ContentBrief> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = $${idx}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      idx++;
    }
    sets.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    values.push(id);
    const result = await this.pool.query(
      `UPDATE content_briefs SET ${sets.join(', ')} WHERE id = $${idx + 1} RETURNING *`,
      values
    );
    return ContentBriefSchema.parse(result.rows[0]);
  }

  async listByProject(projectId: string): Promise<ContentBrief[]> {
    const result = await this.pool.query(
      'SELECT * FROM content_briefs WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    return result.rows.map(r => ContentBriefSchema.parse(r));
  }
}
```

- [ ] **Step 4: Update index.ts exports**

```typescript
export { ContentBriefSchema, type ContentBrief } from './types.js';
export { normalizeArabicKeyword, processKeywordVariants } from './arabic-normalizer.js';
export { checkCannibalization } from './cannibalization.js';
export { checkDraftRate } from './draft-rate.js';
export { PostgresBriefStore, type BriefStore } from './brief-store.js';
```

- [ ] **Step 5: Run all tests and build**

```bash
cd packages/content-briefs && pnpm test && pnpm build
```

Expected: All tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/content-briefs/
git commit -m "feat: add PostgresBriefStore CRUD to @wpi/content-briefs"
```

---

### Task 5: @wpi/content-drafts Package

**Files:**
- Create: `packages/content-drafts/package.json`
- Create: `packages/content-drafts/tsconfig.json`
- Create: `packages/content-drafts/src/types.ts`
- Create: `packages/content-drafts/src/draft-gates.ts`
- Create: `packages/content-drafts/src/draft-store.ts`
- Create: `packages/content-drafts/src/metadata-generator.ts`
- Create: `packages/content-drafts/src/index.ts`
- Create: `packages/content-drafts/tests/draft-gates.test.ts`
- Create: `packages/content-drafts/tests/metadata-generator.test.ts`

**Interfaces:**
- Consumes: ContentBrief (from @wpi/content-briefs), database migrations (Task 1)
- Produces: ContentDraft type, draft gates, draft store, metadata generator

- [ ] **Step 1: Write failing test — draft gates**

Create `packages/content-drafts/tests/draft-gates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkDraftGates } from '../src/draft-gates.js';

describe('checkDraftGates', () => {
  it('rejects when brief is not approved', () => {
    const result = checkDraftGates({
      briefStatus: 'draft',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('brief');
  });

  it('rejects when no named author', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: '',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('author');
  });

  it('rejects when client input not received', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: false,
      clusterMapped: false,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('client');
  });

  it('rejects when cluster already mapped', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: true,
      monthlyDraftCount: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cluster');
  });

  it('rejects when monthly limit reached', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 8,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('limit');
  });

  it('passes all gates', () => {
    const result = checkDraftGates({
      briefStatus: 'approved',
      author: 'John Doe',
      clientInputReceived: true,
      clusterMapped: false,
      monthlyDraftCount: 3,
    });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/content-drafts && pnpm test tests/draft-gates.test.ts`
Expected: FAIL — module not found (package not scaffolded yet)

- [ ] **Step 3: Scaffold package**

Create `packages/content-drafts/package.json`:

```json
{
  "name": "@wpi/content-drafts",
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
    "pg": "^8.13.0",
    "zod": "^3.23.8",
    "@wpi/content-briefs": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

Create `packages/content-drafts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: Define ContentDraft type**

Create `packages/content-drafts/src/types.ts`:

```typescript
import { z } from 'zod';

export const ContentDraftSchema = z.object({
  id: z.string().uuid(),
  brief_id: z.string().uuid(),
  project_id: z.string().uuid(),
  status: z.enum(['drafting', 'review', 'approved', 'published']),
  author: z.string(),
  ai_assisted: z.boolean(),
  ai_disclosure: z.string().nullable(),
  client_input_received: z.boolean(),
  client_input_notes: z.string().nullable(),
  content: z.array(z.object({
    language: z.enum(['ar', 'en']),
    title: z.string(),
    meta_description: z.string(),
    body: z.string(),
    headings: z.array(z.object({
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string(),
    })),
  })),
  facts_used: z.array(z.object({
    fact_id: z.string(),
    fact_sheet_id: z.string(),
    citation: z.string(),
  })),
  internal_links: z.array(z.object({
    url: z.string(),
    anchor: z.string(),
  })),
  schema_json_ld: z.unknown().nullable(),
  word_count: z.object({ ar: z.number(), en: z.number() }),
  reading_time_minutes: z.object({ ar: z.number(), en: z.number() }),
  arabic_reviewer: z.string().nullable(),
  arabic_review_date: z.string().nullable(),
  arabic_review_notes: z.string().nullable(),
  cms_draft_url: z.string().nullable(),
  cms_pr_url: z.string().nullable(),
  published_url: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_updated_content_at: z.string(),
});

export type ContentDraft = z.infer<typeof ContentDraftSchema>;
```

- [ ] **Step 5: Implement draft gates**

Create `packages/content-drafts/src/draft-gates.ts`:

```typescript
export interface DraftGateInput {
  briefStatus: string;
  author: string;
  clientInputReceived: boolean;
  clusterMapped: boolean;
  monthlyDraftCount: number;
}

export function checkDraftGates(input: DraftGateInput): { ok: boolean; error?: string } {
  if (input.briefStatus !== 'approved') {
    return { ok: false, error: 'Brief must be approved before creating a draft' };
  }
  if (!input.author || input.author.trim() === '') {
    return { ok: false, error: 'Draft must have a named human author' };
  }
  if (!input.clientInputReceived) {
    return { ok: false, error: 'Client input is required before starting a draft' };
  }
  if (input.clusterMapped) {
    return { ok: false, error: 'Cluster is already mapped to an existing page' };
  }
  if (input.monthlyDraftCount >= 8) {
    return { ok: false, error: 'Monthly draft limit of 8 has been reached' };
  }
  return { ok: true };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/content-drafts && pnpm test tests/draft-gates.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 7: Write failing test — metadata generator**

Create `packages/content-drafts/tests/metadata-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateMetadata } from '../src/metadata-generator.js';

describe('generateMetadata', () => {
  it('calculates word count per language', () => {
    const content = [
      { language: 'en' as const, title: '', meta_description: '', body: 'This is a test body with words.', headings: [] },
      { language: 'ar' as const, title: '', meta_description: '', body: 'هذا نص اختباري', headings: [] },
    ];
    const metadata = generateMetadata(content);
    expect(metadata.word_count.en).toBeGreaterThan(0);
    expect(metadata.word_count.ar).toBeGreaterThan(0);
  });

  it('calculates reading time (200 words per minute)', () => {
    const words = Array(400).fill('word').join(' ');
    const content = [
      { language: 'en' as const, title: '', meta_description: '', body: words, headings: [] },
    ];
    const metadata = generateMetadata(content);
    expect(metadata.reading_time_minutes.en).toBe(2);
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd packages/content-drafts && pnpm test tests/metadata-generator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 9: Implement metadata generator**

Create `packages/content-drafts/src/metadata-generator.ts`:

```typescript
export function generateMetadata(
  content: { language: 'ar' | 'en'; body: string }[]
): { word_count: { ar: number; en: number }; reading_time_minutes: { ar: number; en: number } } {
  const wordCount = { ar: 0, en: 0 };
  for (const item of content) {
    const count = item.body.split(/\s+/).filter(w => w.length > 0).length;
    wordCount[item.language] += count;
  }
  return {
    word_count: wordCount,
    reading_time_minutes: {
      ar: Math.ceil(wordCount.ar / 200),
      en: Math.ceil(wordCount.en / 200),
    },
  };
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd packages/content-drafts && pnpm test tests/metadata-generator.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 11: Create draft store and index.ts**

Create `packages/content-drafts/src/draft-store.ts`:

```typescript
import type { Pool } from 'pg';
import type { ContentDraft } from './types.js';
import { ContentDraftSchema } from './types.js';

export interface DraftStore {
  create(draft: ContentDraft): Promise<ContentDraft>;
  findById(id: string): Promise<ContentDraft | null>;
  findByBriefId(briefId: string): Promise<ContentDraft[]>;
  findByProjectId(projectId: string): Promise<ContentDraft[]>;
  update(id: string, updates: Partial<ContentDraft>): Promise<ContentDraft>;
  delete(id: string): Promise<void>;
}

export class PostgresDraftStore implements DraftStore {
  constructor(private pool: Pool) {}

  async create(draft: ContentDraft): Promise<ContentDraft> {
    const result = await this.pool.query(
      `INSERT INTO content_drafts (
        id, brief_id, project_id, status, author, ai_assisted, ai_disclosure,
        client_input_received, client_input_notes, content, facts_used,
        internal_links, schema_json_ld, word_count, reading_time_minutes,
        arabic_reviewer, arabic_review_date, arabic_review_notes,
        cms_draft_url, cms_pr_url, published_url, published_at,
        created_at, updated_at, last_updated_content_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *`,
      [
        draft.id, draft.brief_id, draft.project_id, draft.status, draft.author,
        draft.ai_assisted, draft.ai_disclosure, draft.client_input_received,
        draft.client_input_notes, JSON.stringify(draft.content),
        JSON.stringify(draft.facts_used), JSON.stringify(draft.internal_links),
        draft.schema_json_ld ? JSON.stringify(draft.schema_json_ld) : null,
        JSON.stringify(draft.word_count), JSON.stringify(draft.reading_time_minutes),
        draft.arabic_reviewer, draft.arabic_review_date, draft.arabic_review_notes,
        draft.cms_draft_url, draft.cms_pr_url, draft.published_url, draft.published_at,
        draft.created_at, draft.updated_at, draft.last_updated_content_at,
      ]
    );
    return ContentDraftSchema.parse(result.rows[0]);
  }

  async findById(id: string): Promise<ContentDraft | null> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE id = $1', [id]);
    return result.rows[0] ? ContentDraftSchema.parse(result.rows[0]) : null;
  }

  async findByBriefId(briefId: string): Promise<ContentDraft[]> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE brief_id = $1 ORDER BY created_at DESC', [briefId]);
    return result.rows.map(r => ContentDraftSchema.parse(r));
  }

  async findByProjectId(projectId: string): Promise<ContentDraft[]> {
    const result = await this.pool.query('SELECT * FROM content_drafts WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return result.rows.map(r => ContentDraftSchema.parse(r));
  }

  async update(id: string, updates: Partial<ContentDraft>): Promise<ContentDraft> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;
      const jsonFields = ['content', 'facts_used', 'internal_links', 'schema_json_ld', 'word_count', 'reading_time_minutes'];
      if (jsonFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value !== null && value !== undefined ? JSON.stringify(value) : null);
      } else {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const result = await this.pool.query(
      `UPDATE content_drafts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return ContentDraftSchema.parse(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM content_drafts WHERE id = $1', [id]);
  }
}
```

Create `packages/content-drafts/src/index.ts`:

```typescript
export { ContentDraftSchema, type ContentDraft } from './types.js';
export { checkDraftGates, type DraftGateInput } from './draft-gates.js';
export { generateMetadata } from './metadata-generator.js';
export { PostgresDraftStore, type DraftStore } from './draft-store.js';
```

- [ ] **Step 12: Run all tests, build, and commit**

```bash
cd packages/content-drafts && pnpm test && pnpm build
git add packages/content-drafts/
git commit -m "feat: add @wpi/content-drafts package with gates and metadata"
```

---

### Task 6: @wpi/schema-builder Package

**Files:**
- Create: `packages/schema-builder/package.json`
- Create: `packages/schema-builder/tsconfig.json`
- Create: `packages/schema-builder/src/types.ts`
- Create: `packages/schema-builder/src/builder.ts`
- Create: `packages/schema-builder/src/validator.ts`
- Create: `packages/schema-builder/src/diff-engine.ts`
- Create: `packages/schema-builder/src/recommender.ts`
- Create: `packages/schema-builder/src/index.ts`
- Create: `packages/schema-builder/tests/builder.test.ts`
- Create: `packages/schema-builder/tests/validator.test.ts`
- Create: `packages/schema-builder/tests/diff-engine.test.ts`
- Create: `packages/schema-builder/tests/recommender.test.ts`

**Interfaces:**
- Consumes: Audit evidence types (from @wpi/audit-pipeline)
- Produces: Schema builder, validator, diff engine, recommender

- [ ] **Step 1: Scaffold package**

Create `packages/schema-builder/package.json`:

```json
{
  "name": "@wpi/schema-builder",
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
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

Create `packages/schema-builder/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 2: Write failing test — schema builder**

Create `packages/schema-builder/tests/builder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSchema } from '../src/builder.js';

describe('buildSchema', () => {
  it('builds Article schema with required properties', () => {
    const result = buildSchema('Article', {
      headline: 'Test Article',
      author: { name: 'John Doe' },
      datePublished: '2026-10-12',
    });
    expect(result.json_ld['@type']).toBe('Article');
    expect(result.json_ld['headline']).toBe('Test Article');
    expect(result.html_snippet).toContain('application/ld+json');
    expect(result.validation_errors).toHaveLength(0);
  });

  it('builds FAQPage schema', () => {
    const result = buildSchema('FAQPage', {
      mainEntity: [
        { question: 'What?', answer: 'This.' },
      ],
    });
    expect(result.json_ld['@type']).toBe('FAQPage');
  });

  it('returns validation errors for missing required properties', () => {
    const result = buildSchema('Article', {});
    expect(result.validation_errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/schema-builder && pnpm test tests/builder.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement schema builder**

Create `packages/schema-builder/src/types.ts`:

```typescript
import { z } from 'zod';

export const SchemaResultSchema = z.object({
  json_ld: z.record(z.unknown()),
  html_snippet: z.string(),
  validation_errors: z.array(z.string()),
});

export type SchemaResult = z.infer<typeof SchemaResultSchema>;

export const SchemaDiffSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  changed: z.array(z.object({
    path: z.string(),
    old_value: z.unknown(),
    new_value: z.unknown(),
  })),
});

export type SchemaDiff = z.infer<typeof SchemaDiffSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
  warnings: z.array(z.object({ path: z.string(), message: z.string() })),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
```

Create `packages/schema-builder/src/builder.ts`:

```typescript
import type { SchemaResult } from './types.js';

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ['headline', 'author', 'datePublished'],
  FAQPage: ['mainEntity'],
  Product: ['name'],
  LocalBusiness: ['name', 'address'],
};

export function buildSchema(
  type: string,
  data: Record<string, unknown>
): SchemaResult {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  const required = REQUIRED_PROPERTIES[type] ?? [];
  const errors = required.filter(prop => !(prop in data)).map(p => `Missing required property: ${p}`);

  return {
    json_ld: jsonLd,
    html_snippet: `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`,
    validation_errors: errors,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/schema-builder && pnpm test tests/builder.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 6: Write failing test — validator**

Create `packages/schema-builder/tests/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateSchema } from '../src/validator.js';

describe('validateSchema', () => {
  it('validates a correct Article schema', () => {
    const result = validateSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Test',
      author: { name: 'John' },
      datePublished: '2026-10-12',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required properties', () => {
    const result = validateSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Implement validator**

Create `packages/schema-builder/src/validator.ts`:

```typescript
import type { ValidationResult } from './types.js';

const REQUIRED_PROPERTIES: Record<string, string[]> = {
  Article: ['headline', 'author', 'datePublished'],
  FAQPage: ['mainEntity'],
  Product: ['name'],
  LocalBusiness: ['name', 'address'],
};

export function validateSchema(schema: Record<string, unknown>): ValidationResult {
  const type = schema['@type'] as string | undefined;
  if (!type) {
    return { valid: false, errors: [{ path: '@type', message: 'Missing @type' }], warnings: [] };
  }

  const required = REQUIRED_PROPERTIES[type] ?? [];
  const errors = required
    .filter(prop => !(prop in schema))
    .map(prop => ({ path: prop, message: `Missing required property: ${prop}` }));

  return { valid: errors.length === 0, errors, warnings: [] };
}
```

- [ ] **Step 8: Write failing test — diff engine**

Create `packages/schema-builder/tests/diff-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { diffSchema } from '../src/diff-engine.js';

describe('diffSchema', () => {
  it('detects added properties', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old' },
      { '@type': 'Article', headline: 'Old', author: { name: 'John' } }
    );
    expect(result.added).toContain('author');
  });

  it('detects removed properties', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old', author: { name: 'John' } },
      { '@type': 'Article', headline: 'Old' }
    );
    expect(result.removed).toContain('author');
  });

  it('detects changed values', () => {
    const result = diffSchema(
      { '@type': 'Article', headline: 'Old' },
      { '@type': 'Article', headline: 'New' }
    );
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.path).toBe('headline');
  });
});
```

- [ ] **Step 9: Implement diff engine**

Create `packages/schema-builder/src/diff-engine.ts`:

```typescript
import type { SchemaDiff } from './types.js';

export function diffSchema(
  existing: Record<string, unknown>,
  proposed: Record<string, unknown>
): SchemaDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { path: string; old_value: unknown; new_value: unknown }[] = [];

  for (const key of Object.keys(proposed)) {
    if (!(key in existing)) {
      added.push(key);
    } else if (JSON.stringify(existing[key]) !== JSON.stringify(proposed[key])) {
      changed.push({ path: key, old_value: existing[key], new_value: proposed[key] });
    }
  }

  for (const key of Object.keys(existing)) {
    if (!(key in proposed)) {
      removed.push(key);
    }
  }

  return { added, removed, changed };
}
```

- [ ] **Step 10: Write failing test — recommender**

Create `packages/schema-builder/tests/recommender.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recommendSchema } from '../src/recommender.js';

describe('recommendSchema', () => {
  it('recommends FAQPage for pages with FAQ headings', () => {
    const result = recommendSchema({
      headings: ['What is X?', 'How does X work?'],
      hasProduct: false,
      hasReviews: false,
    });
    expect(result).toContain('FAQPage');
  });

  it('recommends Product for pages with product data', () => {
    const result = recommendSchema({
      headings: [],
      hasProduct: true,
      hasReviews: false,
    });
    expect(result).toContain('Product');
  });
});
```

- [ ] **Step 11: Implement recommender**

Create `packages/schema-builder/src/recommender.ts`:

```typescript
export interface AuditEvidence {
  headings: string[];
  hasProduct: boolean;
  hasReviews: boolean;
}

export function recommendSchema(evidence: AuditEvidence): string[] {
  const recommendations: string[] = [];

  const faqPattern = /\?$/;
  if (evidence.headings.some(h => faqPattern.test(h))) {
    recommendations.push('FAQPage');
  }

  if (evidence.hasProduct) {
    recommendations.push('Product');
  }

  if (evidence.hasReviews) {
    recommendations.push('AggregateRating');
  }

  return recommendations;
}
```

- [ ] **Step 12: Create index.ts, run all tests, build, commit**

```typescript
export * from './types.js';
export { buildSchema } from './builder.js';
export { validateSchema } from './validator.js';
export { diffSchema } from './diff-engine.js';
export { recommendSchema, type AuditEvidence } from './recommender.js';
```

```bash
cd packages/schema-builder && pnpm test && pnpm build
git add packages/schema-builder/
git commit -m "feat: add @wpi/schema-builder package"
```

---

### Task 7: @wpi/fact-manifests Package

**Files:**
- Create: `packages/fact-manifests/package.json`, `tsconfig.json`
- Create: `packages/fact-manifests/src/types.ts`
- Create: `packages/fact-manifests/src/regulated-claims.ts`
- Create: `packages/fact-manifests/src/manifest-store.ts`
- Create: `packages/fact-manifests/src/citation-tracker.ts`
- Create: `packages/fact-manifests/src/index.ts`
- Create: `packages/fact-manifests/tests/regulated-claims.test.ts`
- Create: `packages/fact-manifests/tests/citation-tracker.test.ts`

**Interfaces:**
- Consumes: Database migrations (Task 1)
- Produces: FactManifest type, regulated claims detector, citation tracker

- [ ] **Step 1: Scaffold package**

Create `packages/fact-manifests/package.json`:

```json
{
  "name": "@wpi/fact-manifests",
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
    "pg": "^8.13.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

Create `packages/fact-manifests/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 2: Write failing test — regulated claims**

Create `packages/fact-manifests/tests/regulated-claims.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { flagRegulatedClaim } from '../src/regulated-claims.js';

describe('flagRegulatedClaim', () => {
  it('flags health-related claims', () => {
    const result = flagRegulatedClaim({ statement: 'This product can cure headaches' });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe('health');
  });

  it('flags finance-related claims', () => {
    const result = flagRegulatedClaim({ statement: 'Invest now for 10% return' });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe('finance');
  });

  it('flags legal-related claims', () => {
    const result = flagRegulatedClaim({ statement: 'Legal liability is limited by contract' });
    expect(result.requires_review).toBe(true);
    expect(result.topic).toBe('legal');
  });

  it('does not flag non-regulated claims', () => {
    const result = flagRegulatedClaim({ statement: 'Our product is fast and reliable' });
    expect(result.requires_review).toBe(false);
    expect(result.topic).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement**

Create `packages/fact-manifests/src/regulated-claims.ts`:

```typescript
export interface Fact {
  statement: string;
}

export function flagRegulatedClaim(fact: Fact): {
  requires_review: boolean;
  topic: 'health' | 'finance' | 'legal' | null;
} {
  const healthKeywords = ['treat', 'cure', 'diagnose', 'medicine', 'drug'];
  const financeKeywords = ['invest', 'return', 'profit', 'interest', 'loan'];
  const legalKeywords = ['law', 'legal', 'court', 'liability', 'contract'];

  const statement = fact.statement.toLowerCase();

  if (healthKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'health' };
  }
  if (financeKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'finance' };
  }
  if (legalKeywords.some(k => statement.includes(k))) {
    return { requires_review: true, topic: 'legal' };
  }

  return { requires_review: false, topic: null };
}
```

- [ ] **Step 4: Write failing test — citation tracker**

Create `packages/fact-manifests/tests/citation-tracker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { trackCitation, getCitationsForFact, getCitationsForDraft } from '../src/citation-tracker.js';

describe('citation-tracker', () => {
  it('tracks a citation from fact to draft', () => {
    trackCitation({ fact_id: 'fact-1', draft_id: 'draft-1', citation_text: 'As stated in...', url: null });
    const citations = getCitationsForFact('fact-1');
    expect(citations).toHaveLength(1);
    expect(citations[0]!.draft_id).toBe('draft-1');
  });

  it('retrieves all citations for a draft', () => {
    trackCitation({ fact_id: 'fact-1', draft_id: 'draft-2', citation_text: 'Citation 1', url: null });
    trackCitation({ fact_id: 'fact-2', draft_id: 'draft-2', citation_text: 'Citation 2', url: null });
    const citations = getCitationsForDraft('draft-2');
    expect(citations).toHaveLength(2);
  });
});
```

- [ ] **Step 5: Implement citation tracker (in-memory for now)**

Create `packages/fact-manifests/src/citation-tracker.ts`:

```typescript
export interface Citation {
  fact_id: string;
  draft_id: string;
  citation_text: string;
  url: string | null;
}

const citations: Citation[] = [];

export function trackCitation(citation: Citation): void {
  citations.push(citation);
}

export function getCitationsForFact(factId: string): Citation[] {
  return citations.filter(c => c.fact_id === factId);
}

export function getCitationsForDraft(draftId: string): Citation[] {
  return citations.filter(c => c.draft_id === draftId);
}
```

- [ ] **Step 6: Create types.ts, manifest-store.ts, index.ts**

Create `packages/fact-manifests/src/types.ts` with Zod schema for FactManifest matching the spec's FactManifestSchema interface.

Create `packages/fact-manifests/src/manifest-store.ts`:

```typescript
import type { Pool } from 'pg';
import type { FactManifest } from './types.js';

export interface ManifestStore {
  create(manifest: FactManifest): Promise<FactManifest>;
  findById(id: string): Promise<FactManifest | null>;
  findByProjectId(projectId: string): Promise<FactManifest[]>;
  addFact(manifestId: string, fact: FactManifest['facts'][number]): Promise<void>;
  addCitation(citation: FactManifest['citations'][number]): Promise<void>;
}

export class PostgresManifestStore implements ManifestStore {
  constructor(private pool: Pool) {}

  async create(manifest: FactManifest): Promise<FactManifest> {
    await this.pool.query(
      `INSERT INTO fact_manifests (id, project_id, fact_sheet_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [manifest.id, manifest.project_id, manifest.fact_sheet_id, manifest.created_by, manifest.created_at, manifest.updated_at]
    );
    for (const fact of manifest.facts) {
      await this.addFact(manifest.id, fact);
    }
    return manifest;
  }

  async findById(id: string): Promise<FactManifest | null> {
    const { rows } = await this.pool.query('SELECT * FROM fact_manifests WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    const { rows: facts } = await this.pool.query('SELECT * FROM fact_manifest_facts WHERE fact_manifest_id = $1', [id]);
    const { rows: citations } = await this.pool.query('SELECT * FROM fact_manifest_citations WHERE fact_id = ANY($1)', [facts.map((f: any) => f.id)]);
    return { ...rows[0], facts, citations };
  }

  async findByProjectId(projectId: string): Promise<FactManifest[]> {
    const { rows } = await this.pool.query('SELECT * FROM fact_manifests WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return rows;
  }

  async addFact(manifestId: string, fact: FactManifest['facts'][number]): Promise<void> {
    await this.pool.query(
      `INSERT INTO fact_manifest_facts (id, fact_manifest_id, category, statement, evidence, regulated, regulated_topic, requires_professional_review, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [fact.id, manifestId, fact.category, fact.statement, JSON.stringify(fact.evidence), fact.regulated, fact.regulated_topic, fact.requires_professional_review, fact.expires_at, fact.evidence.retrieved_at]
    );
  }

  async addCitation(citation: FactManifest['citations'][number]): Promise<void> {
    await this.pool.query(
      `INSERT INTO fact_manifest_citations (id, fact_id, draft_id, citation_text, url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [citation.id, citation.fact_id, citation.draft_id, citation.citation_text, citation.url, new Date().toISOString()]
    );
  }
}
```

Create `packages/fact-manifests/src/index.ts`:

```typescript
export { flagRegulatedClaim, type Fact } from './regulated-claims.js';
export { CitationTracker, type Citation } from './citation-tracker.js';
export { PostgresManifestStore, type ManifestStore } from './manifest-store.js';
```

- [ ] **Step 7: Run all tests, build, and commit**

```bash
cd packages/fact-manifests && pnpm test && pnpm build
git add packages/fact-manifests/
git commit -m "feat: add @wpi/fact-manifests package"
```

---

### Task 8: @wpi/content-approvals Package

**Files:**
- Create: `packages/content-approvals/package.json`, `tsconfig.json`
- Create: `packages/content-approvals/src/types.ts`
- Create: `packages/content-approvals/src/state-machine.ts`
- Create: `packages/content-approvals/src/risk-tiers.ts`
- Create: `packages/content-approvals/src/validation-rules.ts`
- Create: `packages/content-approvals/src/forbidden-detector.ts`
- Create: `packages/content-approvals/src/change-window.ts`
- Create: `packages/content-approvals/src/approval-store.ts`
- Create: `packages/content-approvals/src/index.ts`
- Create test files for each module

**Interfaces:**
- Consumes: Database migrations (Task 1)
- Produces: Approval state machine, risk tier enforcement, validation rules, forbidden detector, change window

- [ ] **Step 1: Scaffold package**

Create `packages/content-approvals/package.json`:

```json
{
  "name": "@wpi/content-approvals",
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
    "pg": "^8.13.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.1"
  }
}
```

Create `packages/content-approvals/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 2: Write failing test — state machine**

Create `packages/content-approvals/tests/state-machine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transitionState, type ApprovalState } from '../src/state-machine.js';

describe('transitionState', () => {
  it('transitions draft → validated when checks pass', () => {
    const result = transitionState('draft', 'validated', { checksPassed: true });
    expect(result.ok).toBe(true);
    expect(result.newState).toBe('validated');
  });

  it('rejects draft → validated when checks fail', () => {
    const result = transitionState('draft', 'validated', { checksPassed: false });
    expect(result.ok).toBe(false);
  });

  it('transitions validated → previewed', () => {
    const result = transitionState('validated', 'previewed', {});
    expect(result.ok).toBe(true);
  });

  it('transitions previewed → approved', () => {
    const result = transitionState('previewed', 'approved', {});
    expect(result.ok).toBe(true);
  });

  it('allows rejection from any non-terminal state', () => {
    expect(transitionState('draft', 'rejected', {}).ok).toBe(true);
    expect(transitionState('validated', 'rejected', {}).ok).toBe(true);
    expect(transitionState('previewed', 'rejected', {}).ok).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(transitionState('approved', 'draft', {}).ok).toBe(false);
    expect(transitionState('rejected', 'approved', {}).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Implement state machine**

Create `packages/content-approvals/src/state-machine.ts`:

```typescript
export type ApprovalState = 'draft' | 'validated' | 'previewed' | 'approved' | 'rejected';

interface TransitionContext {
  checksPassed?: boolean;
}

export function transitionState(
  current: ApprovalState,
  target: ApprovalState,
  context: TransitionContext
): { ok: boolean; newState?: ApprovalState; error?: string } {
  const validTransitions: Record<ApprovalState, ApprovalState[]> = {
    draft: ['validated', 'rejected'],
    validated: ['previewed', 'rejected'],
    previewed: ['approved', 'rejected'],
    approved: [],
    rejected: [],
  };

  if (!validTransitions[current]?.includes(target)) {
    return { ok: false, error: `Invalid transition from ${current} to ${target}` };
  }

  if (target === 'validated' && !context.checksPassed) {
    return { ok: false, error: 'Cannot validate: deterministic checks failed' };
  }

  return { ok: true, newState: target };
}
```

- [ ] **Step 4: Write failing test — risk tiers**

Create `packages/content-approvals/tests/risk-tiers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkApprovalRequirements } from '../src/risk-tiers.js';

describe('checkApprovalRequirements', () => {
  it('Tier 1 requires one approver', () => {
    const result = checkApprovalRequirements(1, [
      { user_id: 'user-1', is_requester: false },
    ]);
    expect(result.ok).toBe(true);
  });

  it('Tier 3 requires two approvers', () => {
    const result = checkApprovalRequirements(3, [
      { user_id: 'user-1', is_requester: false },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('two approvers');
  });

  it('Tier 3 rejects requester as approver', () => {
    const result = checkApprovalRequirements(3, [
      { user_id: 'user-1', is_requester: true },
      { user_id: 'user-2', is_requester: false },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('requester');
  });

  it('Tier 3 passes with two non-requester approvers', () => {
    const result = checkApprovalRequirements(3, [
      { user_id: 'user-1', is_requester: false },
      { user_id: 'user-2', is_requester: false },
    ]);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 5: Implement risk tiers**

Create `packages/content-approvals/src/risk-tiers.ts`:

```typescript
export interface Approver {
  user_id: string;
  is_requester: boolean;
}

export function checkApprovalRequirements(
  riskTier: 1 | 2 | 3,
  approvers: Approver[]
): { ok: boolean; error?: string } {
  if (riskTier === 1 || riskTier === 2) {
    if (approvers.length < 1) {
      return { ok: false, error: 'Requires at least one approver' };
    }
    return { ok: true };
  }

  if (riskTier === 3) {
    if (approvers.length < 2) {
      return { ok: false, error: 'Tier 3 requires two approvers' };
    }
    if (approvers.some(a => a.is_requester)) {
      return { ok: false, error: 'Requester cannot be an approver for Tier 3' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Invalid risk tier' };
}
```

- [ ] **Step 6: Write failing test — forbidden detector**

Create `packages/content-approvals/tests/forbidden-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isForbidden } from '../src/forbidden-detector.js';

describe('isForbidden', () => {
  it('detects page deletion', () => {
    const result = isForbidden({ field_name: 'status', new_value: 'deleted' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('deletion');
  });

  it('detects hidden text (display: none)', () => {
    const result = isForbidden({ field_name: 'css', new_value: 'display: none' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('Hidden text');
  });

  it('detects hidden text (visibility: hidden)', () => {
    const result = isForbidden({ field_name: 'css', new_value: 'visibility: hidden' });
    expect(result.forbidden).toBe(true);
  });

  it('detects fabricated reviews without evidence', () => {
    const result = isForbidden({ field_name: 'review', new_value: '5 stars', evidence_citation: undefined });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('evidence');
  });

  it('allows reviews with evidence citation', () => {
    const result = isForbidden({ field_name: 'review', new_value: '5 stars', evidence_citation: 'fact-1' });
    expect(result.forbidden).toBe(false);
  });

  it('detects cloaking (different content for search engines)', () => {
    const result = isForbidden({ field_name: 'meta_redirect', new_value: 'url=/admin-only' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('loaking');
  });

  it('detects link schemes (paid links without rel=sponsored)', () => {
    const result = isForbidden({ field_name: 'content', new_value: '<a href="https://spam.example">buy now</a>' });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('link');
  });

  it('allows links with rel=sponsored', () => {
    const result = isForbidden({ field_name: 'content', new_value: '<a href="https://partner.example" rel="sponsored">partner</a>' });
    expect(result.forbidden).toBe(false);
  });

  it('detects keyword stuffing', () => {
    const result = isForbidden({
      field_name: 'meta_description',
      new_value: 'buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes buy shoes',
    });
    expect(result.forbidden).toBe(true);
    expect(result.reason).toContain('keyword');
  });

  it('allows normal changes', () => {
    const result = isForbidden({ field_name: 'title', new_value: 'New Title' });
    expect(result.forbidden).toBe(false);
  });
});
```

- [ ] **Step 7: Implement forbidden detector**

Create `packages/content-approvals/src/forbidden-detector.ts`:

```typescript
export interface ChangeSetItem {
  field_name: string;
  new_value: string;
  evidence_citation?: string;
}

export function isForbidden(change: ChangeSetItem): { forbidden: boolean; reason?: string } {
  if (change.field_name === 'status' && change.new_value === 'deleted') {
    return { forbidden: true, reason: 'Page deletion is forbidden; use redirects or noindex' };
  }

  const hiddenTextPatterns = [
    /display\s*:\s*none/i,
    /visibility\s*:\s*hidden/i,
    /color\s*:\s*(#fff|white|transparent)/i,
  ];
  if (hiddenTextPatterns.some(p => p.test(change.new_value))) {
    return { forbidden: true, reason: 'Hidden text detected' };
  }

  if (change.field_name === 'review' && !change.evidence_citation) {
    return { forbidden: true, reason: 'Reviews must cite evidence' };
  }

  if (change.field_name === 'meta_redirect' && /url=/i.test(change.new_value)) {
    return { forbidden: true, reason: 'Cloaking detected: meta redirect to different content' };
  }

  const linkPattern = /<a\s[^>]*href=(?!['"]#)[^>]*>(?!.*rel=["']sponsored["'])/i;
  if (change.field_name === 'content' && linkPattern.test(change.new_value)) {
    const hasSponsored = /rel=["']sponsored["']/i.test(change.new_value);
    if (!hasSponsored) {
      return { forbidden: true, reason: 'Link scheme detected: paid links without rel="sponsored"' };
    }
  }

  const words = change.new_value.toLowerCase().split(/\s+/);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.floor(words.length * 0.3));
  for (const [, count] of freq) {
    if (count >= threshold) {
      return { forbidden: true, reason: 'Keyword stuffing detected' };
    }
  }

  return { forbidden: false };
}
```

- [ ] **Step 8: Write failing test — validation rules**

Create `packages/content-approvals/tests/validation-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateChangeItem } from '../src/validation-rules.js';

describe('validateChangeItem', () => {
  it('rejects title over 60 characters', () => {
    const result = validateChangeItem({ field_name: 'title', new_value: 'A'.repeat(61) });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('60');
  });

  it('rejects meta description over 160 characters', () => {
    const result = validateChangeItem({ field_name: 'meta_description', new_value: 'A'.repeat(161) });
    expect(result.valid).toBe(false);
  });

  it('rejects H1 over 70 characters', () => {
    const result = validateChangeItem({ field_name: 'h1', new_value: 'A'.repeat(71) });
    expect(result.valid).toBe(false);
  });

  it('accepts valid title', () => {
    const result = validateChangeItem({ field_name: 'title', new_value: 'Valid Title' });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 9: Implement validation rules**

Create `packages/content-approvals/src/validation-rules.ts`:

```typescript
export interface ChangeItem {
  field_name: string;
  new_value: string;
}

const LENGTH_LIMITS: Record<string, number> = {
  title: 60,
  meta_description: 160,
  h1: 70,
  og_title: 60,
  og_description: 200,
};

export function validateChangeItem(item: ChangeItem): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const limit = LENGTH_LIMITS[item.field_name];
  if (limit && item.new_value.length > limit) {
    errors.push(`${item.field_name} exceeds maximum length of ${limit} characters`);
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 10: Write failing test — change window**

Create `packages/content-approvals/tests/change-window.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isWithinChangeWindow, type ChangeWindow } from '../src/change-window.js';

describe('isWithinChangeWindow', () => {
  it('allows Tier 1 changes outside window', () => {
    const window: ChangeWindow = { project_id: 'p1', day_of_week: 2, start_time: '10:00', end_time: '12:00', timezone: 'UTC' };
    const now = new Date('2026-10-13T15:00:00Z'); // Wednesday
    expect(isWithinChangeWindow(1, window, now)).toBe(true);
  });

  it('rejects Tier 3 changes outside window', () => {
    const window: ChangeWindow = { project_id: 'p1', day_of_week: 2, start_time: '10:00', end_time: '12:00', timezone: 'UTC' };
    const now = new Date('2026-10-13T15:00:00Z'); // Wednesday
    expect(isWithinChangeWindow(3, window, now)).toBe(false);
  });

  it('allows Tier 3 changes within window', () => {
    const window: ChangeWindow = { project_id: 'p1', day_of_week: 2, start_time: '10:00', end_time: '12:00', timezone: 'UTC' };
    const now = new Date('2026-10-14T10:30:00Z'); // Tuesday 10:30
    expect(isWithinChangeWindow(3, window, now)).toBe(true);
  });
});
```

- [ ] **Step 11: Implement change window**

Create `packages/content-approvals/src/change-window.ts`:

```typescript
export interface ChangeWindow {
  project_id: string;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start_time: string;
  end_time: string;
  timezone: string;
}

export function isWithinChangeWindow(
  riskTier: number,
  window: ChangeWindow,
  now: Date
): boolean {
  if (riskTier < 3) return true;

  const day = now.getUTCDay();
  if (day !== window.day_of_week) return false;

  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return currentTime >= window.start_time && currentTime <= window.end_time;
}
```

- [ ] **Step 12: Write failing test — approval expiry**

Create `packages/content-approvals/tests/approval-expiry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isApprovalExpired } from '../src/approval-expiry.js';

describe('isApprovalExpired', () => {
  it('returns false when approval is within expiry window', () => {
    const approvedAt = new Date('2026-10-10T10:00:00Z');
    const now = new Date('2026-10-12T10:00:00Z');
    expect(isApprovalExpired(approvedAt, now, 7)).toBe(false);
  });

  it('returns true when approval has expired', () => {
    const approvedAt = new Date('2026-10-01T10:00:00Z');
    const now = new Date('2026-10-10T10:00:00Z');
    expect(isApprovalExpired(approvedAt, now, 7)).toBe(true);
  });
});
```

- [ ] **Step 13: Implement approval expiry**

Create `packages/content-approvals/src/approval-expiry.ts`:

```typescript
const DEFAULT_EXPIRY_DAYS = 7;

export function isApprovalExpired(
  approvedAt: Date,
  now: Date,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): boolean {
  const expiryDate = new Date(approvedAt);
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return now > expiryDate;
}
```

- [ ] **Step 14: Create types.ts, approval-store.ts, index.ts**

Create `packages/content-approvals/src/types.ts` with Zod schemas for ChangeSet, ChangeSetItem, ApprovalRecord matching the migration schema.

Create `packages/content-approvals/src/approval-store.ts`:

```typescript
import type { Pool } from 'pg';
import type { ChangeSet, ChangeSetItem, ApprovalRecord } from './types.js';

export interface ApprovalStore {
  createChangeSet(changeSet: ChangeSet, items: ChangeSetItem[]): Promise<ChangeSet>;
  findChangeSetById(id: string): Promise<(ChangeSet & { items: ChangeSetItem[] }) | null>;
  findChangeSetsByProjectId(projectId: string): Promise<ChangeSet[]>;
  updateChangeSetStatus(id: string, status: ChangeSet['status']): Promise<void>;
  createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord>;
  findApprovalByChangeSetId(changeSetId: string): Promise<ApprovalRecord | null>;
  updateApprovalStatus(id: string, status: ApprovalRecord['status']): Promise<void>;
}

export class PostgresApprovalStore implements ApprovalStore {
  constructor(private pool: Pool) {}

  async createChangeSet(changeSet: ChangeSet, items: ChangeSetItem[]): Promise<ChangeSet> {
    await this.pool.query(
      `INSERT INTO change_sets (id, project_id, description, risk_tier, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [changeSet.id, changeSet.project_id, changeSet.description, changeSet.risk_tier, changeSet.status, changeSet.created_by, changeSet.created_at, changeSet.updated_at]
    );
    for (const item of items) {
      await this.pool.query(
        `INSERT INTO change_set_items (id, change_set_id, page_url, field_name, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [item.id, changeSet.id, item.page_url, item.field_name, item.old_value, item.new_value, item.created_at]
      );
    }
    return changeSet;
  }

  async findChangeSetById(id: string): Promise<(ChangeSet & { items: ChangeSetItem[] }) | null> {
    const { rows } = await this.pool.query('SELECT * FROM change_sets WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    const { rows: items } = await this.pool.query('SELECT * FROM change_set_items WHERE change_set_id = $1', [id]);
    return { ...rows[0], items };
  }

  async findChangeSetsByProjectId(projectId: string): Promise<ChangeSet[]> {
    const { rows } = await this.pool.query('SELECT * FROM change_sets WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return rows;
  }

  async updateChangeSetStatus(id: string, status: ChangeSet['status']): Promise<void> {
    await this.pool.query('UPDATE change_sets SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
  }

  async createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord> {
    await this.pool.query(
      `INSERT INTO approval_records (id, change_set_id, risk_tier, approvers, expires_at, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [record.id, record.change_set_id, record.risk_tier, JSON.stringify(record.approvers), record.expires_at, record.status, record.created_at, record.updated_at]
    );
    return record;
  }

  async findApprovalByChangeSetId(changeSetId: string): Promise<ApprovalRecord | null> {
    const { rows } = await this.pool.query('SELECT * FROM approval_records WHERE change_set_id = $1', [changeSetId]);
    return rows[0] ?? null;
  }

  async updateApprovalStatus(id: string, status: ApprovalRecord['status']): Promise<void> {
    await this.pool.query('UPDATE approval_records SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
  }
}
```

Create `packages/content-approvals/src/index.ts`:

```typescript
export { transitionState, type ApprovalState, type TransitionContext } from './state-machine.js';
export { checkApprovalRequirements, type Approver } from './risk-tiers.js';
export { isForbidden, type ChangeSetItem as ForbiddenCheckItem } from './forbidden-detector.js';
export { validateChangeItem, type ChangeItem } from './validation-rules.js';
export { isWithinChangeWindow, type ChangeWindow } from './change-window.js';
export { isApprovalExpired } from './approval-expiry.js';
export { PostgresApprovalStore, type ApprovalStore } from './approval-store.js';
```

- [ ] **Step 15: Run all tests, build, and commit**

```bash
cd packages/content-approvals && pnpm test && pnpm build
git add packages/content-approvals/
git commit -m "feat: add @wpi/content-approvals package"
```

---

### Task 9: Agent Tools Integration

**Files:**
- Modify: `services/agents/src/tools/write-brief.ts`
- Create: `services/agents/src/tools/create-draft.ts`
- Create: `services/agents/src/tools/build-schema.ts`
- Create: `services/agents/src/tools/manage-facts.ts`
- Create: `services/agents/src/tools/request-approval.ts`
- Modify: `services/agents/src/tools/index.ts`
- Modify: `services/agents/src/tools/registry.ts` (register new tools)
- Create: `services/agents/src/agents/content-strategist.yaml`

**Interfaces:**
- Consumes: @wpi/content-briefs, @wpi/content-drafts, @wpi/schema-builder, @wpi/fact-manifests, @wpi/content-approvals
- Produces: Agent tools for content workflow

- [ ] **Step 1: Enhance write-brief.ts**

Update `services/agents/src/tools/write-brief.ts` to use `@wpi/content-briefs` for cannibalization check and Arabic normalization.

- [ ] **Step 2: Create create-draft.ts**

Create `services/agents/src/tools/create-draft.ts`:

```typescript
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  brief_id: z.string(),
  project_id: z.string(),
  title_en: z.string(),
  title_ar: z.string().optional(),
  content_en: z.string(),
  content_ar: z.string().optional(),
  author: z.string(),
});

export function createCreateDraftTool(): Tool {
  return {
    name: 'create_draft',
    description: 'Creates a content draft from an approved brief. Checks draft gates before creating.',
    inputSchema: {
      type: 'object',
      properties: {
        brief_id: { type: 'string' },
        project_id: { type: 'string' },
        title_en: { type: 'string' },
        title_ar: { type: 'string' },
        content_en: { type: 'string' },
        content_ar: { type: 'string' },
        author: { type: 'string' },
      },
      required: ['brief_id', 'project_id', 'title_en', 'content_en', 'author'],
    },
    async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { checkDraftGates } = await import('@wpi/content-drafts');
      const gates = await checkDraftGates(data.brief_id, data.project_id);
      if (!gates.allowed) {
        return { data: { error: 'Draft gates not met', reasons: gates.reasons }, source_tier: 'first_party', limitations: [] };
      }
      return {
        data: { draft: { brief_id: data.brief_id, title_en: data.title_en, content_en: data.content_en, author: data.author, status: 'draft' } },
        source_tier: 'first_party',
        limitations: [],
      };
    },
  };
}
```

- [ ] **Step 3: Create build-schema.ts**

Create `services/agents/src/tools/build-schema.ts`:

```typescript
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  schema_type: z.enum(['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList']),
  data: z.record(z.unknown()),
  project_id: z.string(),
});

export function createBuildSchemaTool(): Tool {
  return {
    name: 'build_schema',
    description: 'Builds and validates JSON-LD schema from type and data.',
    inputSchema: {
      type: 'object',
      properties: {
        schema_type: { type: 'string', enum: ['Article', 'Product', 'LocalBusiness', 'FAQPage', 'HowTo', 'BreadcrumbList'] },
        data: { type: 'object' },
        project_id: { type: 'string' },
      },
      required: ['schema_type', 'data', 'project_id'],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const { schema_type, data, project_id } = inputSchema.parse(input);
      const { buildSchema, validateSchema } = await import('@wpi/schema-builder');
      const schema = buildSchema(schema_type, data);
      const validation = validateSchema(schema);
      return {
        data: { schema, validation, project_id },
        source_tier: 'first_party',
        limitations: validation.valid ? [] : ['Schema validation errors found'],
      };
    },
  };
}
```

- [ ] **Step 4: Create manage-facts.ts**

Create `services/agents/src/tools/manage-facts.ts`:

```typescript
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  manifest_id: z.string(),
  claim_text: z.string(),
  regulated: z.boolean().optional(),
  regulation_type: z.string().optional(),
  source_url: z.string().optional(),
});

export function createManageFactsTool(): Tool {
  return {
    name: 'manage_facts',
    description: 'Adds or flags facts in a fact manifest. Flags regulated claims.',
    inputSchema: {
      type: 'object',
      properties: {
        manifest_id: { type: 'string' },
        claim_text: { type: 'string' },
        regulated: { type: 'boolean' },
        regulation_type: { type: 'string' },
        source_url: { type: 'string' },
      },
      required: ['manifest_id', 'claim_text'],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { flagRegulatedClaim } = await import('@wpi/fact-manifests');
      const result = data.regulated
        ? await flagRegulatedClaim(data.manifest_id, data.claim_text, data.regulation_type ?? 'general', data.source_url)
        : { fact_id: crypto.randomUUID(), claim_text: data.claim_text, regulated: false };
      return { data: result, source_tier: 'first_party', limitations: [] };
    },
  };
}
```

- [ ] **Step 5: Create request-approval.ts**

Create `services/agents/src/tools/request-approval.ts`:

```typescript
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from './types.js';

const inputSchema = z.object({
  project_id: z.string(),
  change_items: z.array(z.object({
    field_name: z.string(),
    old_value: z.string().optional(),
    new_value: z.string(),
  })),
  requester_id: z.string(),
});

export function createRequestApprovalTool(): Tool {
  return {
    name: 'request_approval',
    description: 'Creates a change set and initiates the approval workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        change_items: { type: 'array', items: { type: 'object' } },
        requester_id: { type: 'string' },
      },
      required: ['project_id', 'change_items', 'requester_id'],
    },
    async execute(input: unknown, _context: ToolContext): Promise<ToolResult> {
      const data = inputSchema.parse(input);
      const { transitionState, checkApprovalRequirements } = await import('@wpi/content-approvals');
      const requirements = checkApprovalRequirements(data.change_items);
      const changeSetId = crypto.randomUUID();
      await transitionState(changeSetId, 'create', data.requester_id);
      return {
        data: { change_set_id: changeSetId, risk_tier: requirements.riskTier, required_approvers: requirements.requiredApprovers },
        source_tier: 'first_party',
        limitations: [],
      };
    },
  };
}
```

- [ ] **Step 6: Create content-strategist agent config**

Create `services/agents/src/agents/content-strategist.yaml`:

```yaml
name: content-strategist
description: Content strategy agent for briefs, drafts, schema, facts, and approvals.
model_tier: standard
tools:
  - find_opportunities
  - check_cannibalization
  - write_brief
  - create_draft
  - build_schema
  - manage_facts
  - request_approval
budget:
  max_tokens_per_session: 50000
  max_cost_per_session_usd: 0.50
```

- [ ] **Step 7: Register new tools in index.ts**

```typescript
export { createCreateDraftTool } from './create-draft.js';
export { createBuildSchemaTool } from './build-schema.js';
export { createManageFactsTool } from './manage-facts.js';
export { createRequestApprovalTool } from './request-approval.js';
```

- [ ] **Step 8: Run tests, build, commit**

```bash
cd services/agents && pnpm test && pnpm build
git add services/agents/
git commit -m "feat: add M8 agent tools (create-draft, build-schema, manage-facts, request-approval)"
```

---

### Task 10: API Routes — Briefs and Drafts

**Files:**
- Create: `apps/web/src/app/[locale]/api/briefs/route.ts`
- Create: `apps/web/src/app/[locale]/api/briefs/[id]/route.ts`
- Create: `apps/web/src/app/[locale]/api/briefs/[id]/approve/route.ts`
- Create: `apps/web/src/app/[locale]/api/drafts/route.ts`
- Create: `apps/web/src/app/[locale]/api/drafts/[id]/route.ts`
- Create: `apps/web/src/app/[locale]/api/drafts/[id]/approve/route.ts`

**Interfaces:**
- Consumes: @wpi/content-briefs, @wpi/content-drafts
- Produces: REST API endpoints

- [ ] **Step 1: Create briefs API routes**

Create `apps/web/src/app/[locale]/api/briefs/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createBriefSchema } from '@wpi/content-briefs';

const createSchema = z.object({
  project_id: z.string().uuid(),
  primary_keyword: z.string().min(1),
  intent: z.enum(['informational', 'transactional', 'navigational']),
  audience: z.string().min(1),
  page_goal: z.string().min(1),
  cluster_id: z.string().uuid().optional(),
  target_url: z.string().url().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  const brief = await createBriefSchema(parsed.data);
  return NextResponse.json(brief, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, briefs: [] });
}
```

Create `apps/web/src/app/[locale]/api/briefs/[id]/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json({ id, status: 'not_found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  return NextResponse.json({ id, updated: true });
}
```

Create `apps/web/src/app/[locale]/api/briefs/[id]/approve/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json({ id, status: 'approved' });
}
```

- [ ] **Step 2: Create drafts API routes**

Create `apps/web/src/app/[locale]/api/drafts/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const createDraftSchema = z.object({
  brief_id: z.string().uuid(),
  project_id: z.string().uuid(),
  title_en: z.string().min(1),
  title_ar: z.string().optional(),
  content_en: z.string().min(1),
  content_ar: z.string().optional(),
  author: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json({ ...parsed.data, status: 'draft' }, { status: 201 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const projectId = new URL(request.url).searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id_required' }, { status: 400 });
  return NextResponse.json({ project_id: projectId, drafts: [] });
}
```

Create `apps/web/src/app/[locale]/api/drafts/[id]/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json({ id, status: 'not_found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  return NextResponse.json({ id, updated: true });
}
```

Create `apps/web/src/app/[locale]/api/drafts/[id]/approve/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json({ id, status: 'approved' });
}
```

- [ ] **Step 3: Test, build, commit**

```bash
cd apps/web && pnpm build
git add apps/web/
git commit -m "feat: add API routes for briefs and drafts"
```

---

### Task 11: API Routes — Schema, Facts, and Approvals

**Files:**
- Create: `apps/web/src/app/[locale]/api/schema/route.ts`
- Create: `apps/web/src/app/[locale]/api/schema/validate/route.ts`
- Create: `apps/web/src/app/[locale]/api/fact-manifests/route.ts`
- Create: `apps/web/src/app/[locale]/api/fact-manifests/[id]/route.ts`
- Create: `apps/web/src/app/[locale]/api/change-sets/route.ts`
- Create: `apps/web/src/app/[locale]/api/change-sets/[id]/approve/route.ts`
- Create: `apps/web/src/app/[locale]/api/change-windows/route.ts`

**Interfaces:**
- Consumes: @wpi/schema-builder, @wpi/fact-manifests, @wpi/content-approvals
- Produces: REST API endpoints

- [ ] **Step 1: Create schema API routes**
- [ ] **Step 2: Create fact-manifests API routes**
- [ ] **Step 3: Create change-sets and change-windows API routes**
- [ ] **Step 4: Test, build, commit**

---

### Task 12: UI — Briefs Pages

**Files:**
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/briefs/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/briefs/_components/brief-list.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/briefs/_components/brief-form.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/briefs/[id]/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/briefs/[id]/_components/brief-view.tsx`

**Interfaces:**
- Consumes: Briefs API routes (Task 10)
- Produces: Briefs UI

- [ ] **Step 1: Create briefs list page and components**
- [ ] **Step 2: Create brief detail page**
- [ ] **Step 3: Test in browser, commit**

---

### Task 13: UI — Drafts Pages

**Files:**
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/drafts/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/drafts/_components/draft-list.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/drafts/_components/draft-form.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/drafts/[id]/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/drafts/[id]/_components/draft-view.tsx`

**Interfaces:**
- Consumes: Drafts API routes (Task 10)
- Produces: Drafts UI

- [ ] **Step 1: Create drafts list page and components**
- [ ] **Step 2: Create draft detail page with bilingual content**
- [ ] **Step 3: Test in browser, commit**

---

### Task 14: UI — Schema Builder, Fact Manifest Editor, and Approvals Dashboard

**Files:**
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/schema/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/schema/_components/schema-form.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/schema/_components/schema-preview.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-manifests/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-manifests/_components/manifest-list.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-manifests/_components/fact-form.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-manifests/_components/regulated-claim-badge.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/approvals/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/approvals/_components/approval-list.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/approvals/[id]/_components/approval-review.tsx`

**Interfaces:**
- Consumes: Schema, fact-manifests, and approvals API routes (Task 11)
- Produces: Schema builder, fact manifest editor, and approvals UI

- [ ] **Step 1: Create schema builder page with JSON-LD preview**
- [ ] **Step 2: Create fact manifest editor with regulated claim badges and citation tracker**
- [ ] **Step 3: Create approvals dashboard with risk tier badges**
- [ ] **Step 4: Test in browser, commit**

---

### Task 15: i18n Keys (en + ar)

**Files:**
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/ar.json`

**Interfaces:**
- Consumes: UI components (Tasks 12-14)
- Produces: Bilingual translations

- [ ] **Step 1: Add briefs translations**

Add to `en.json`:

```json
"briefs": {
  "title": "Content Briefs",
  "create_new": "Create Brief",
  "empty_state": "No briefs yet. Create one to get started.",
  "status": {
    "draft": "Draft",
    "approved": "Approved",
    "rejected": "Rejected"
  },
  "opportunity_type": {
    "unmapped_cluster": "Unmapped Cluster",
    "low_ctr": "Low CTR",
    "visibility_gap": "Visibility Gap",
    "aeo_failure": "AEO Failure"
  },
  "fields": {
    "primary_keyword": "Primary Keyword",
    "intent": "Intent",
    "audience": "Audience",
    "page_goal": "Page Goal"
  },
  "cannibalization_warning": "This cluster is already mapped to {url}. Improve that page instead.",
  "approve": "Approve Brief",
  "reject": "Reject Brief"
}
```

- [ ] **Step 2: Add drafts translations**
- [ ] **Step 3: Add schema translations**
- [ ] **Step 4: Add approvals translations**
- [ ] **Step 5: Add Arabic translations to ar.json**
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/messages/
git commit -m "feat: add M8 i18n keys (en + ar)"
```

---

### Task 16: Final Verification

**Files:**
- All packages and apps

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified, working M8 implementation

- [ ] **Step 1: Run full test suite**

```bash
pnpm -r test
```

Expected: All tests pass

- [ ] **Step 2: Run type check**

```bash
pnpm -r typecheck
```

Expected: No errors

- [ ] **Step 3: Build all packages**

```bash
pnpm -r build
```

Expected: All packages build successfully

- [ ] **Step 4: Start dev server and test in browser**

```bash
cd apps/web && pnpm dev
```

Test:
- Create a brief
- Approve the brief
- Create a draft from the brief
- Build schema
- Create a change set and approve it

- [ ] **Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: final M8 verification fixes"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-12-m8-content-schema-studio.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
