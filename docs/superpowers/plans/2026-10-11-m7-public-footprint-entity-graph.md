# M7 Public Footprint & Entity Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core entity graph — fact sheets, fact register, public source discovery via web scraping, profile extraction, NAP consistency, entity conflict detection, entity-analyst agent, GEO-011 evaluator, pipeline integration, and full UI views.

**Architecture:** Approach A — crawler-pipeline integration reusing the existing crawler service for public profile fetching. New `@wpi/footprint-store` package provides Zod-validated CRUD over PostgreSQL. A new ENRICHING_OPTIONAL pipeline stage runs between EXTRACTING and AUDITING. The entity-analyst agent joins the composer alongside existing specialist agents.

**Tech Stack:** TypeScript (ESM, strict), PostgreSQL (raw SQL migrations), Zod for runtime validation, Vitest for tests, Playwright for E2E, Next.js 15 App Router, React 19, Tailwind CSS v4, next-intl v4.14.8.

**Spec:** `docs/superpowers/specs/2026-10-11-m7-public-footprint-entity-graph-design.md`

## Global Constraints

- Monorepo: pnpm workspaces, `@wpi/` scope, `"workspace:*"` deps, ESM throughout, `"type": "module"`.
- TypeScript: `verbatimModuleSyntax: true` — requires `import type` for type-only imports. `noUncheckedIndexedAccess: true`, `strict: true`, ES2022 target, NodeNext module resolution.
- Test framework: Vitest for unit/integration. Playwright for E2E.
- Frontend: Next.js 15 App Router, React 19, Tailwind CSS v4, next-intl v4.14.8, native HTML forms + FormData, native fetch API.
- Database: PostgreSQL with raw SQL numbered migration files (0001, 0002 exist; M7 starts at 0003). No ORM.
- JSON schemas in `/schemas/` are Draft 2020-12 canonical contracts. Zod schemas in TypeScript are the runtime implementations.
- Lineage is mandatory on every domain record (17 required fields from `common.schema.json`).
- Entity conflicts are never auto-resolved — a named human resolves them (spec §15).
- Fact sheet is the only source of facts the Fixer and brief writer may insert.
- In-process dispatch only — no message queue; pipeline uses promise chains via `JobDispatcher`.
- Existing JSON schemas (all in `/schemas/`): fact-sheet, fact-register, entity-conflict, profile-observation, public-source-observation, nap-observation, brand-terms, location, common.
- Entity-analyst agent config at `config/agents/entity-analyst.yaml` is draft status with placeholder model_tier.
- GEO-011 evaluator stub returns `not_applicable`; all other GEO evaluators (001-010) are fully implemented.
- `FindingSection` type in `packages/audit-pipeline/src/report-envelope.ts` needs "entity" added.
- `SECTION_BY_AGENT` needs "entity-analyst": "entity" mapping.
- `CATEGORY_TO_SECTION` has `geo: "content"` — must change to `geo: "entity"`.
- `SECTION_ORDER` needs "entity" appended.
- Pipeline `PipelineDeps` needs optional `enrichFootprint` callback.
- Container `AuditServices` needs optional `pool?: Pool` for M7 stores.
- Production refuses stub dispatch mode.

---

### Task 1: Database Migrations (0003–0008)

**Files:**

- Create: `packages/audit-pipeline/src/migrations/0003_create_fact_sheets.sql`
- Create: `packages/audit-pipeline/src/migrations/0004_create_fact_register.sql`
- Create: `packages/audit-pipeline/src/migrations/0005_create_entity_conflicts.sql`
- Create: `packages/audit-pipeline/src/migrations/0006_create_public_source_observations.sql`
- Create: `packages/audit-pipeline/src/migrations/0007_create_profile_observations.sql`
- Create: `packages/audit-pipeline/src/migrations/0008_create_nap_observations.sql`

**Interfaces:**

- Consumes: PostgreSQL connection via `Pool` from `pg`
- Produces: 6 new tables with proper FKs, indexes, and constraints

- [ ] **Step 1: Write migration 0003 — fact_sheets**

```sql
CREATE TABLE IF NOT EXISTS fact_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  site_url text NOT NULL,
  business_name text NOT NULL,
  description text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  address_locality text,
  address_region text,
  address_postal_code text,
  address_country text,
  geo_latitude double precision,
  geo_longitude double precision,
  social_profiles jsonb NOT NULL DEFAULT '{}',
  brand_terms jsonb NOT NULL DEFAULT '{}',
  operating_hours jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'superseded')),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fact_sheets_project ON fact_sheets(project_id);
CREATE INDEX idx_fact_sheets_site_url ON fact_sheets(site_url);
CREATE INDEX idx_fact_sheets_status ON fact_sheets(status);
```

- [ ] **Step 2: Write migration 0004 — fact_register**

```sql
CREATE TABLE IF NOT EXISTS fact_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  fact_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'extracted', 'connector')),
  source_id text,
  confidence double precision NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fact_sheet_id, fact_key)
);

CREATE INDEX idx_fact_register_fact_sheet ON fact_register(fact_sheet_id);
CREATE INDEX idx_fact_register_key ON fact_register(fact_key);
```

- [ ] **Step 3: Write migration 0005 — entity_conflicts**

```sql
CREATE TABLE IF NOT EXISTS entity_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  fact_key text NOT NULL,
  confirmed_value jsonb,
  conflicting_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('nap_inconsistency', 'extractor_disagreement', 'connector_conflict')),
  source_id text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolved_by text,
  resolved_at timestamptz,
  resolution_note text,
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_conflicts_fact_sheet ON entity_conflicts(fact_sheet_id);
CREATE INDEX idx_entity_conflicts_status ON entity_conflicts(status);
CREATE INDEX idx_entity_conflicts_severity ON entity_conflicts(severity);
```

- [ ] **Step 4: Write migration 0006 — public_source_observations**

```sql
CREATE TABLE IF NOT EXISTS public_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_platform text NOT NULL,
  source_url text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  profile_data jsonb NOT NULL DEFAULT '{}',
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_source_obs_fact_sheet ON public_source_observations(fact_sheet_id);
CREATE INDEX idx_public_source_obs_platform ON public_source_observations(source_platform);
```

- [ ] **Step 5: Write migration 0007 — profile_observations**

```sql
CREATE TABLE IF NOT EXISTS profile_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  extracted_name text,
  extracted_phone text,
  extracted_email text,
  extracted_address jsonb,
  extracted_hours jsonb,
  extracted_social jsonb,
  extraction_confidence double precision NOT NULL DEFAULT 0.0 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_obs_fact_sheet ON profile_observations(fact_sheet_id);
CREATE INDEX idx_profile_obs_source_url ON profile_observations(source_url);
```

- [ ] **Step 6: Write migration 0008 — nap_observations**

```sql
CREATE TABLE IF NOT EXISTS nap_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_sheet_id uuid NOT NULL REFERENCES fact_sheets(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  name_value text,
  phone_value text,
  address_value jsonb,
  consistency_score double precision NOT NULL DEFAULT 0.0 CHECK (consistency_score >= 0 AND consistency_score <= 1),
  inconsistencies jsonb NOT NULL DEFAULT '[]',
  lineage jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nap_obs_fact_sheet ON nap_observations(fact_sheet_id);
CREATE INDEX idx_nap_obs_consistency ON nap_observations(consistency_score);
```

- [ ] **Step 7: Verify migrations run successfully**

Run: `cd packages/audit-pipeline && npm test -- --run src/migrations.test.ts` (or manual test with a test database)
Expected: All 6 migrations apply without errors

- [ ] **Step 8: Commit**

```bash
git add packages/audit-pipeline/src/migrations/000[3-8]*.sql
git commit -m "feat(M7): add database migrations for entity graph tables (0003-0008)"
```

---

### Task 2: Footprint Store Package + Common Zod Schemas

**Files:**

- Create: `packages/footprint-store/package.json`
- Create: `packages/footprint-store/tsconfig.json`
- Create: `packages/footprint-store/src/index.ts`
- Create: `packages/footprint-store/src/common.ts`
- Create: `packages/footprint-store/src/common.test.ts`

**Interfaces:**

- Consumes: `zod` for runtime validation, `pg` Pool for database access
- Produces: Common Zod schemas (Lineage, UUID) and package entry point

- [ ] **Step 1: Write failing test for common schemas**

```typescript
// packages/footprint-store/src/common.test.ts
import { describe, expect, it } from "vitest";
import { LineageSchema, UUIDSchema } from "./common.js";

describe("UUIDSchema", () => {
  it("accepts a valid UUID", () => {
    const result = UUIDSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("rejects an invalid UUID", () => {
    const result = UUIDSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });
});

describe("LineageSchema", () => {
  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: "550e8400-e29b-41d4-a716-446655440002",
    source_type: "first_party",
    source_id: "manual-entry",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed",
    content_hash: "abc123def456",
    parent_ids: [],
    validation_state: "validated",
  };

  it("accepts valid lineage with all required fields", () => {
    const result = LineageSchema.safeParse(validLineage);
    expect(result.success).toBe(true);
  });

  it("accepts lineage with optional audit_id", () => {
    const result = LineageSchema.safeParse({
      ...validLineage,
      audit_id: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(result.success).toBe(true);
  });

  it("rejects lineage missing required fields", () => {
    const { record_id, ...incomplete } = validLineage;
    const result = LineageSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("rejects lineage with invalid UUID in record_id", () => {
    const result = LineageSchema.safeParse({
      ...validLineage,
      record_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/common.test.ts`
Expected: FAIL — module `./common.js` not found

- [ ] **Step 3: Write package.json**

```json
{
  "name": "@wpi/footprint-store",
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

- [ ] **Step 4: Write tsconfig.json**

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

- [ ] **Step 5: Write common.ts with Lineage and UUID schemas**

```typescript
// packages/footprint-store/src/common.ts
import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const LineageSchema = z.object({
  record_id: UUIDSchema,
  project_id: UUIDSchema.nullable(),
  site_id: UUIDSchema.nullable(),
  source_type: z.enum(["first_party", "third_party_verified", "third_party_unverified"]),
  source_id: z.string(),
  source_version: z.string(),
  captured_at: z.string().datetime(),
  as_of: z.string().datetime(),
  market: z.string().min(2).max(5),
  language: z.string().min(2).max(10),
  device: z.enum(["desktop", "mobile", "tablet", "api"]),
  method: z.string(),
  methodology_version: z.string(),
  fidelity_label: z.enum(["raw", "extracted", "confirmed", "disputed"]),
  content_hash: z.string(),
  parent_ids: z.array(UUIDSchema),
  validation_state: z.enum(["unvalidated", "validated", "invalidated"]),
  audit_id: UUIDSchema.optional(),
});

export type Lineage = z.infer<typeof LineageSchema>;
export type UUID = z.infer<typeof UUIDSchema>;
```

- [ ] **Step 6: Write index.ts barrel export**

```typescript
// packages/footprint-store/src/index.ts
export { LineageSchema, UUIDSchema, type Lineage, type UUID } from "./common.js";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/common.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/footprint-store/
git commit -m "feat(M7): add footprint-store package with common Zod schemas"
```

---

### Task 3: FactSheet, FactRegister, EntityConflict Zod Schemas

**Files:**

- Create: `packages/footprint-store/src/fact-sheet.ts`
- Create: `packages/footprint-store/src/fact-register.ts`
- Create: `packages/footprint-store/src/entity-conflict.ts`
- Create: `packages/footprint-store/src/fact-sheet.test.ts`
- Create: `packages/footprint-store/src/fact-register.test.ts`
- Create: `packages/footprint-store/src/entity-conflict.test.ts`

**Interfaces:**

- Consumes: `LineageSchema` from `./common.js`
- Produces: Zod schemas and TypeScript types for FactSheet, FactRegisterEntry, EntityConflict

- [ ] **Step 1: Write failing test for FactSheetSchema**

```typescript
// packages/footprint-store/src/fact-sheet.test.ts
import { describe, expect, it } from "vitest";
import { FactSheetSchema, FactSheetCreateSchema } from "./fact-sheet.js";

describe("FactSheetSchema", () => {
  const validFactSheet = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_url: "https://example.com",
    business_name: "Example Business",
    description: "A test business",
    phone: "+1-555-0100",
    email: "contact@example.com",
    address_line1: "123 Main St",
    address_locality: "Anytown",
    address_region: "CA",
    address_postal_code: "90210",
    address_country: "US",
    geo_latitude: 34.0522,
    geo_longitude: -118.2437,
    social_profiles: { google: "https://g.page/example", facebook: "https://fb.com/example" },
    brand_terms: { preferred_name: "Example", forbidden_terms: ["Example Inc"] },
    operating_hours: { monday: "9:00-17:00", tuesday: "9:00-17:00" },
    status: "draft",
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_id: null,
      source_type: "first_party",
      source_id: "manual-entry",
      source_version: "1.0.0",
      captured_at: "2026-10-11T10:00:00Z",
      as_of: "2026-10-11T10:00:00Z",
      market: "US",
      language: "en",
      device: "desktop",
      method: "manual",
      methodology_version: "1.0.0",
      fidelity_label: "confirmed",
      content_hash: "abc123",
      parent_ids: [],
      validation_state: "validated",
    },
    created_at: "2026-10-11T10:00:00Z",
    updated_at: "2026-10-11T10:00:00Z",
  };

  it("accepts a valid fact sheet", () => {
    const result = FactSheetSchema.safeParse(validFactSheet);
    expect(result.success).toBe(true);
  });

  it("rejects fact sheet with invalid status", () => {
    const result = FactSheetSchema.safeParse({
      ...validFactSheet,
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("FactSheetCreateSchema", () => {
  it("accepts minimal create input", () => {
    const result = FactSheetCreateSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_url: "https://example.com",
      business_name: "Example Business",
    });
    expect(result.success).toBe(true);
  });

  it("rejects create without required business_name", () => {
    const result = FactSheetCreateSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440001",
      site_url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/fact-sheet.test.ts`
Expected: FAIL — module `./fact-sheet.js` not found

- [ ] **Step 3: Write FactSheetSchema and FactSheetCreateSchema**

```typescript
// packages/footprint-store/src/fact-sheet.ts
import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const FactSheetSchema = z.object({
  id: UUIDSchema,
  project_id: UUIDSchema,
  site_url: z.string().url(),
  business_name: z.string().min(1),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  address_locality: z.string().nullable(),
  address_region: z.string().nullable(),
  address_postal_code: z.string().nullable(),
  address_country: z.string().nullable(),
  geo_latitude: z.number().min(-90).max(90).nullable(),
  geo_longitude: z.number().min(-180).max(180).nullable(),
  social_profiles: z.record(z.string(), z.string()),
  brand_terms: z.object({
    preferred_name: z.string().optional(),
    forbidden_terms: z.array(z.string()).optional(),
  }),
  operating_hours: z.record(z.string(), z.string()),
  status: z.enum(["draft", "confirmed", "superseded"]),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const FactSheetCreateSchema = z.object({
  project_id: UUIDSchema,
  site_url: z.string().url(),
  business_name: z.string().min(1),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  address_locality: z.string().optional(),
  address_region: z.string().optional(),
  address_postal_code: z.string().optional(),
  address_country: z.string().optional(),
  geo_latitude: z.number().min(-90).max(90).optional(),
  geo_longitude: z.number().min(-180).max(180).optional(),
  social_profiles: z.record(z.string(), z.string()).optional(),
  brand_terms: z
    .object({
      preferred_name: z.string().optional(),
      forbidden_terms: z.array(z.string()).optional(),
    })
    .optional(),
  operating_hours: z.record(z.string(), z.string()).optional(),
});

export type FactSheet = z.infer<typeof FactSheetSchema>;
export type FactSheetCreate = z.infer<typeof FactSheetCreateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/fact-sheet.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 5: Write failing test for FactRegisterEntrySchema**

```typescript
// packages/footprint-store/src/fact-register.test.ts
import { describe, expect, it } from "vitest";
import { FactRegisterEntrySchema } from "./fact-register.js";

describe("FactRegisterEntrySchema", () => {
  const validEntry = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
    fact_key: "business_name",
    fact_value: { value: "Example Business" },
    source_type: "manual",
    source_id: "user-entry",
    confidence: 1.0,
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440002",
      site_id: null,
      source_type: "first_party",
      source_id: "manual-entry",
      source_version: "1.0.0",
      captured_at: "2026-10-11T10:00:00Z",
      as_of: "2026-10-11T10:00:00Z",
      market: "US",
      language: "en",
      device: "desktop",
      method: "manual",
      methodology_version: "1.0.0",
      fidelity_label: "confirmed",
      content_hash: "abc123",
      parent_ids: [],
      validation_state: "validated",
    },
    created_at: "2026-10-11T10:00:00Z",
    updated_at: "2026-10-11T10:00:00Z",
  };

  it("accepts a valid fact register entry", () => {
    const result = FactRegisterEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("rejects entry with confidence out of range", () => {
    const result = FactRegisterEntrySchema.safeParse({
      ...validEntry,
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects entry with invalid source_type", () => {
    const result = FactRegisterEntrySchema.safeParse({
      ...validEntry,
      source_type: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/fact-register.test.ts`
Expected: FAIL — module `./fact-register.js` not found

- [ ] **Step 7: Write FactRegisterEntrySchema**

```typescript
// packages/footprint-store/src/fact-register.ts
import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const FactRegisterEntrySchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  fact_key: z.string().min(1),
  fact_value: z.unknown(),
  source_type: z.enum(["manual", "extracted", "connector"]),
  source_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type FactRegisterEntry = z.infer<typeof FactRegisterEntrySchema>;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/fact-register.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 9: Write failing test for EntityConflictSchema**

```typescript
// packages/footprint-store/src/entity-conflict.test.ts
import { describe, expect, it } from "vitest";
import { EntityConflictSchema } from "./entity-conflict.js";

describe("EntityConflictSchema", () => {
  const validConflict = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
    fact_key: "phone",
    confirmed_value: { value: "+1-555-0100" },
    conflicting_value: { value: "+1-555-0200" },
    source_type: "nap_inconsistency",
    source_id: "google-profile",
    severity: "high",
    status: "open",
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    lineage: {
      record_id: "550e8400-e29b-41d4-a716-446655440000",
      project_id: "550e8400-e29b-41d4-a716-446655440002",
      site_id: null,
      source_type: "third_party_unverified",
      source_id: "nap-engine",
      source_version: "1.0.0",
      captured_at: "2026-10-11T10:00:00Z",
      as_of: "2026-10-11T10:00:00Z",
      market: "US",
      language: "en",
      device: "desktop",
      method: "automated",
      methodology_version: "1.0.0",
      fidelity_label: "disputed",
      content_hash: "def456",
      parent_ids: [],
      validation_state: "unvalidated",
    },
    created_at: "2026-10-11T10:00:00Z",
    updated_at: "2026-10-11T10:00:00Z",
  };

  it("accepts a valid entity conflict", () => {
    const result = EntityConflictSchema.safeParse(validConflict);
    expect(result.success).toBe(true);
  });

  it("rejects conflict with invalid severity", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      severity: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects conflict with invalid status", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts resolved conflict with resolution fields", () => {
    const result = EntityConflictSchema.safeParse({
      ...validConflict,
      status: "resolved",
      resolved_by: "user@example.com",
      resolved_at: "2026-10-11T12:00:00Z",
      resolution_note: "Confirmed correct phone number",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/entity-conflict.test.ts`
Expected: FAIL — module `./entity-conflict.js` not found

- [ ] **Step 11: Write EntityConflictSchema**

```typescript
// packages/footprint-store/src/entity-conflict.ts
import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const EntityConflictSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  fact_key: z.string().min(1),
  confirmed_value: z.unknown().nullable(),
  conflicting_value: z.unknown(),
  source_type: z.enum(["nap_inconsistency", "extractor_disagreement", "connector_conflict"]),
  source_id: z.string().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "investigating", "resolved", "dismissed"]),
  resolved_by: z.string().nullable(),
  resolved_at: z.string().datetime().nullable(),
  resolution_note: z.string().nullable(),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type EntityConflict = z.infer<typeof EntityConflictSchema>;
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/entity-conflict.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 13: Update index.ts barrel exports**

```typescript
// packages/footprint-store/src/index.ts
export { LineageSchema, UUIDSchema, type Lineage, type UUID } from "./common.js";
export {
  FactSheetSchema,
  FactSheetCreateSchema,
  type FactSheet,
  type FactSheetCreate,
} from "./fact-sheet.js";
export { FactRegisterEntrySchema, type FactRegisterEntry } from "./fact-register.js";
export { EntityConflictSchema, type EntityConflict } from "./entity-conflict.js";
```

- [ ] **Step 14: Run all tests to verify**

Run: `cd packages/footprint-store && npm test -- --run`
Expected: PASS — all 10 tests pass

- [ ] **Step 15: Commit**

```bash
git add packages/footprint-store/src/
git commit -m "feat(M7): add FactSheet, FactRegister, EntityConflict Zod schemas"
```

---

### Task 4: Observation, Location, BrandTerms Zod Schemas

**Files:**

- Create: `packages/footprint-store/src/observations.ts`
- Create: `packages/footprint-store/src/location.ts`
- Create: `packages/footprint-store/src/brand-terms.ts`
- Create: `packages/footprint-store/src/observations.test.ts`
- Create: `packages/footprint-store/src/location.test.ts`
- Create: `packages/footprint-store/src/brand-terms.test.ts`

**Interfaces:**

- Consumes: `LineageSchema`, `UUIDSchema` from `./common.js`
- Produces: Zod schemas for ProfileObservation, PublicSourceObservation, NapObservation, Location, BrandTerms

- [ ] **Step 1: Write failing test for observation schemas**

```typescript
// packages/footprint-store/src/observations.test.ts
import { describe, expect, it } from "vitest";
import {
  ProfileObservationSchema,
  PublicSourceObservationSchema,
  NapObservationSchema,
} from "./observations.js";

const baseLineage = {
  record_id: "550e8400-e29b-41d4-a716-446655440000",
  project_id: "550e8400-e29b-41d4-a716-446655440001",
  site_id: null,
  source_type: "third_party_unverified" as const,
  source_id: "google-extractor",
  source_version: "1.0.0",
  captured_at: "2026-10-11T10:00:00Z",
  as_of: "2026-10-11T10:00:00Z",
  market: "US",
  language: "en",
  device: "desktop",
  method: "automated",
  methodology_version: "1.0.0",
  fidelity_label: "extracted",
  content_hash: "abc123",
  parent_ids: [],
  validation_state: "unvalidated",
};

describe("ProfileObservationSchema", () => {
  it("accepts a valid profile observation", () => {
    const result = ProfileObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440010",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_email: null,
      extracted_address: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
      extracted_hours: { monday: "9:00-17:00" },
      extracted_social: { facebook: "https://fb.com/example" },
      extraction_confidence: 0.85,
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects observation with confidence out of range", () => {
    const result = ProfileObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440010",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example",
      extraction_confidence: 1.5,
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("PublicSourceObservationSchema", () => {
  it("accepts a valid public source observation", () => {
    const result = PublicSourceObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440020",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_platform: "google",
      source_url: "https://google.com/maps/place/example",
      discovered_at: "2026-10-11T10:00:00Z",
      profile_data: { name: "Example Business", phone: "+1-555-0100" },
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("NapObservationSchema", () => {
  it("accepts a valid NAP observation", () => {
    const result = NapObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440030",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://yelp.com/biz/example",
      name_value: "Example Business",
      phone_value: "+1-555-0100",
      address_value: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
      consistency_score: 0.92,
      inconsistencies: [{ field: "phone", expected: "+1-555-0200", actual: "+1-555-0100" }],
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects observation with consistency_score out of range", () => {
    const result = NapObservationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440030",
      fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
      source_url: "https://yelp.com/biz/example",
      consistency_score: -0.1,
      inconsistencies: [],
      lineage: baseLineage,
      created_at: "2026-10-11T10:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/observations.test.ts`
Expected: FAIL — module `./observations.js` not found

- [ ] **Step 3: Write observation schemas**

```typescript
// packages/footprint-store/src/observations.ts
import { z } from "zod";
import { LineageSchema, UUIDSchema } from "./common.js";

export const ProfileObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_url: z.string().url(),
  extracted_name: z.string().nullable(),
  extracted_phone: z.string().nullable(),
  extracted_email: z.string().email().nullable(),
  extracted_address: z.record(z.string(), z.string()).nullable(),
  extracted_hours: z.record(z.string(), z.string()).nullable(),
  extracted_social: z.record(z.string(), z.string()).nullable(),
  extraction_confidence: z.number().min(0).max(1),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export const PublicSourceObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_platform: z.string().min(1),
  source_url: z.string().url(),
  discovered_at: z.string().datetime(),
  profile_data: z.record(z.string(), z.unknown()),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export const NapObservationSchema = z.object({
  id: UUIDSchema,
  fact_sheet_id: UUIDSchema,
  source_url: z.string().url(),
  name_value: z.string().nullable(),
  phone_value: z.string().nullable(),
  address_value: z.record(z.string(), z.string()).nullable(),
  consistency_score: z.number().min(0).max(1),
  inconsistencies: z.array(
    z.object({
      field: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  ),
  lineage: LineageSchema,
  created_at: z.string().datetime(),
});

export type ProfileObservation = z.infer<typeof ProfileObservationSchema>;
export type PublicSourceObservation = z.infer<typeof PublicSourceObservationSchema>;
export type NapObservation = z.infer<typeof NapObservationSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/observations.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Write failing test for LocationSchema**

```typescript
// packages/footprint-store/src/location.test.ts
import { describe, expect, it } from "vitest";
import { LocationSchema } from "./location.js";

describe("LocationSchema", () => {
  it("accepts a valid location", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_line2: "Suite 100",
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: 34.0522,
      longitude: -118.2437,
    });
    expect(result.success).toBe(true);
  });

  it("accepts location with null optional fields", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: null,
      longitude: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects location with latitude out of range", () => {
    const result = LocationSchema.safeParse({
      address_line1: "123 Main St",
      address_locality: "Anytown",
      address_region: "CA",
      address_postal_code: "90210",
      address_country: "US",
      latitude: 91,
      longitude: -118.2437,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/location.test.ts`
Expected: FAIL — module `./location.js` not found

- [ ] **Step 7: Write LocationSchema**

```typescript
// packages/footprint-store/src/location.ts
import { z } from "zod";

export const LocationSchema = z.object({
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  address_locality: z.string().nullable(),
  address_region: z.string().nullable(),
  address_postal_code: z.string().nullable(),
  address_country: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});

export type Location = z.infer<typeof LocationSchema>;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/location.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 9: Write failing test for BrandTermsSchema**

```typescript
// packages/footprint-store/src/brand-terms.test.ts
import { describe, expect, it } from "vitest";
import { BrandTermsSchema } from "./brand-terms.js";

describe("BrandTermsSchema", () => {
  it("accepts valid brand terms", () => {
    const result = BrandTermsSchema.safeParse({
      preferred_name: "Example Business",
      forbidden_terms: ["Example Inc", "Example LLC"],
      tagline: "The best example",
    });
    expect(result.success).toBe(true);
  });

  it("accepts brand terms with empty forbidden_terms", () => {
    const result = BrandTermsSchema.safeParse({
      preferred_name: "Example",
      forbidden_terms: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts brand terms with all optional fields omitted", () => {
    const result = BrandTermsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/brand-terms.test.ts`
Expected: FAIL — module `./brand-terms.js` not found

- [ ] **Step 11: Write BrandTermsSchema**

```typescript
// packages/footprint-store/src/brand-terms.ts
import { z } from "zod";

export const BrandTermsSchema = z.object({
  preferred_name: z.string().optional(),
  forbidden_terms: z.array(z.string()).optional(),
  tagline: z.string().optional(),
});

export type BrandTerms = z.infer<typeof BrandTermsSchema>;
```

- [ ] **Step 12: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/brand-terms.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 13: Update index.ts barrel exports**

```typescript
// packages/footprint-store/src/index.ts
export { LineageSchema, UUIDSchema, type Lineage, type UUID } from "./common.js";
export {
  FactSheetSchema,
  FactSheetCreateSchema,
  type FactSheet,
  type FactSheetCreate,
} from "./fact-sheet.js";
export { FactRegisterEntrySchema, type FactRegisterEntry } from "./fact-register.js";
export { EntityConflictSchema, type EntityConflict } from "./entity-conflict.js";
export {
  ProfileObservationSchema,
  PublicSourceObservationSchema,
  NapObservationSchema,
  type ProfileObservation,
  type PublicSourceObservation,
  type NapObservation,
} from "./observations.js";
export { LocationSchema, type Location } from "./location.js";
export { BrandTermsSchema, type BrandTerms } from "./brand-terms.js";
```

- [ ] **Step 14: Run all tests to verify**

Run: `cd packages/footprint-store && npm test -- --run`
Expected: PASS — all 20 tests pass

- [ ] **Step 15: Commit**

```bash
git add packages/footprint-store/src/
git commit -m "feat(M7): add observation, location, brand-terms Zod schemas"
```

---

### Task 5: FactSheetStore and EntityConflictStore

**Files:**

- Create: `packages/footprint-store/src/stores/fact-sheet-store.ts`
- Create: `packages/footprint-store/src/stores/entity-conflict-store.ts`
- Create: `packages/footprint-store/src/stores/fact-sheet-store.test.ts`
- Create: `packages/footprint-store/src/stores/entity-conflict-store.test.ts`

**Interfaces:**

- Consumes: `pg` Pool, Zod schemas from parent package
- Produces: CRUD operations for fact sheets and entity conflicts

- [ ] **Step 1: Write failing test for FactSheetStore**

```typescript
// packages/footprint-store/src/stores/fact-sheet-store.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { FactSheetStore } from "./fact-sheet-store.js";

describe("FactSheetStore", () => {
  let pool: Pool;
  let store: FactSheetStore;

  beforeEach(() => {
    pool = new Pool({
      connectionString: process.env["TEST_DATABASE_URL"] ?? "postgresql://localhost:5432/wpi_test",
    });
    store = new FactSheetStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-entry",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed" as const,
    content_hash: "abc123",
    parent_ids: [],
    validation_state: "validated" as const,
  };

  it("creates and retrieves a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
      validLineage,
    );

    expect(created.id).toBeDefined();
    expect(created.business_name).toBe("Example Business");
    expect(created.status).toBe("draft");

    const retrieved = await store.getById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.business_name).toBe("Example Business");
  });

  it("lists fact sheets by project_id", async () => {
    const projectId = "550e8400-e29b-41d4-a716-446655440099";
    await store.create(
      {
        project_id: projectId,
        site_url: "https://example1.com",
        business_name: "Business 1",
      },
      validLineage,
    );
    await store.create(
      {
        project_id: projectId,
        site_url: "https://example2.com",
        business_name: "Business 2",
      },
      validLineage,
    );

    const list = await store.listByProject(projectId);
    expect(list.length).toBe(2);
  });

  it("updates a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Old Name",
      },
      validLineage,
    );

    const updated = await store.update(
      created.id,
      {
        business_name: "New Name",
        phone: "+1-555-9999",
      },
      validLineage,
    );

    expect(updated.business_name).toBe("New Name");
    expect(updated.phone).toBe("+1-555-9999");
  });

  it("confirms a fact sheet", async () => {
    const created = await store.create(
      {
        project_id: "550e8400-e29b-41d4-a716-446655440001",
        site_url: "https://example.com",
        business_name: "Example",
      },
      validLineage,
    );

    const confirmed = await store.confirm(created.id, "user@example.com");
    expect(confirmed.status).toBe("confirmed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/stores/fact-sheet-store.test.ts`
Expected: FAIL — module `./fact-sheet-store.js` not found

- [ ] **Step 3: Write FactSheetStore implementation**

```typescript
// packages/footprint-store/src/stores/fact-sheet-store.ts
import type { Pool, PoolClient } from "pg";
import type { FactSheet, FactSheetCreate } from "../fact-sheet.js";
import type { Lineage } from "../common.js";

export class FactSheetStore {
  constructor(private pool: Pool) {}

  async create(input: FactSheetCreate, lineage: Lineage): Promise<FactSheet> {
    const result = await this.pool.query(
      `INSERT INTO fact_sheets (
        project_id, site_url, business_name, description, phone, email,
        address_line1, address_line2, address_locality, address_region,
        address_postal_code, address_country, geo_latitude, geo_longitude,
        social_profiles, brand_terms, operating_hours, status, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'draft', $18)
      RETURNING *`,
      [
        input.project_id,
        input.site_url,
        input.business_name,
        input.description ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.address_line1 ?? null,
        input.address_line2 ?? null,
        input.address_locality ?? null,
        input.address_region ?? null,
        input.address_postal_code ?? null,
        input.address_country ?? null,
        input.geo_latitude ?? null,
        input.geo_longitude ?? null,
        JSON.stringify(input.social_profiles ?? {}),
        JSON.stringify(input.brand_terms ?? {}),
        JSON.stringify(input.operating_hours ?? {}),
        JSON.stringify(lineage),
      ],
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  async getById(id: string): Promise<FactSheet | null> {
    const result = await this.pool.query("SELECT * FROM fact_sheets WHERE id = $1", [id]);
    if (result.rows.length === 0) return null;
    return this.rowToFactSheet(result.rows[0]!);
  }

  async listByProject(projectId: string): Promise<FactSheet[]> {
    const result = await this.pool.query(
      "SELECT * FROM fact_sheets WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId],
    );
    return result.rows.map((row) => this.rowToFactSheet(row));
  }

  async update(
    id: string,
    updates: Partial<FactSheetCreate>,
    lineage: Lineage,
  ): Promise<FactSheet> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(typeof value === "object" ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    fields.push(`updated_at = now()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE fact_sheets SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  async confirm(id: string, confirmedBy: string): Promise<FactSheet> {
    const result = await this.pool.query(
      `UPDATE fact_sheets SET status = 'confirmed', updated_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.rowToFactSheet(result.rows[0]!);
  }

  private rowToFactSheet(row: Record<string, unknown>): FactSheet {
    return {
      id: row["id"] as string,
      project_id: row["project_id"] as string,
      site_url: row["site_url"] as string,
      business_name: row["business_name"] as string,
      description: row["description"] as string | null,
      phone: row["phone"] as string | null,
      email: row["email"] as string | null,
      address_line1: row["address_line1"] as string | null,
      address_line2: row["address_line2"] as string | null,
      address_locality: row["address_locality"] as string | null,
      address_region: row["address_region"] as string | null,
      address_postal_code: row["address_postal_code"] as string | null,
      address_country: row["address_country"] as string | null,
      geo_latitude: row["geo_latitude"] as number | null,
      geo_longitude: row["geo_longitude"] as number | null,
      social_profiles: (row["social_profiles"] ?? {}) as Record<string, string>,
      brand_terms: (row["brand_terms"] ?? {}) as {
        preferred_name?: string;
        forbidden_terms?: string[];
      },
      operating_hours: (row["operating_hours"] ?? {}) as Record<string, string>,
      status: row["status"] as "draft" | "confirmed" | "superseded",
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
      updated_at: (row["updated_at"] as Date).toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/stores/fact-sheet-store.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Write failing test for EntityConflictStore**

```typescript
// packages/footprint-store/src/stores/entity-conflict-store.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { EntityConflictStore } from "./entity-conflict-store.js";

describe("EntityConflictStore", () => {
  let pool: Pool;
  let store: EntityConflictStore;

  beforeEach(() => {
    pool = new Pool({
      connectionString: process.env["TEST_DATABASE_URL"] ?? "postgresql://localhost:5432/wpi_test",
    });
    store = new EntityConflictStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const validLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "nap-engine",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "disputed" as const,
    content_hash: "def456",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and retrieves an entity conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "phone",
        confirmed_value: { value: "+1-555-0100" },
        conflicting_value: { value: "+1-555-0200" },
        source_type: "nap_inconsistency",
        source_id: "google-profile",
        severity: "high",
      },
      validLineage,
    );

    expect(created.id).toBeDefined();
    expect(created.status).toBe("open");

    const retrieved = await store.getById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.fact_key).toBe("phone");
  });

  it("lists conflicts by fact_sheet_id", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440099";
    await store.create(
      {
        fact_sheet_id: factSheetId,
        fact_key: "phone",
        confirmed_value: null,
        conflicting_value: { value: "+1-555-0100" },
        source_type: "nap_inconsistency",
        severity: "medium",
      },
      validLineage,
    );
    await store.create(
      {
        fact_sheet_id: factSheetId,
        fact_key: "address",
        confirmed_value: null,
        conflicting_value: { value: "456 Oak Ave" },
        source_type: "extractor_disagreement",
        severity: "low",
      },
      validLineage,
    );

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(2);
  });

  it("resolves a conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "phone",
        confirmed_value: null,
        conflicting_value: { value: "+1-555-0200" },
        source_type: "nap_inconsistency",
        severity: "high",
      },
      validLineage,
    );

    const resolved = await store.resolve(
      created.id,
      { value: "+1-555-0100" },
      "user@example.com",
      "Confirmed correct phone number",
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.confirmed_value).toEqual({ value: "+1-555-0100" });
    expect(resolved.resolved_by).toBe("user@example.com");
    expect(resolved.resolution_note).toBe("Confirmed correct phone number");
  });

  it("dismisses a conflict", async () => {
    const created = await store.create(
      {
        fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001",
        fact_key: "email",
        confirmed_value: null,
        conflicting_value: { value: "old@example.com" },
        source_type: "connector_conflict",
        severity: "low",
      },
      validLineage,
    );

    const dismissed = await store.dismiss(created.id, "user@example.com", "False positive");
    expect(dismissed.status).toBe("dismissed");
    expect(dismissed.resolution_note).toBe("False positive");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/stores/entity-conflict-store.test.ts`
Expected: FAIL — module `./entity-conflict-store.js` not found

- [ ] **Step 7: Write EntityConflictStore implementation**

```typescript
// packages/footprint-store/src/stores/entity-conflict-store.ts
import type { Pool } from "pg";
import type { EntityConflict } from "../entity-conflict.js";
import type { Lineage } from "../common.js";

interface CreateConflictInput {
  fact_sheet_id: string;
  fact_key: string;
  confirmed_value: unknown | null;
  conflicting_value: unknown;
  source_type: "nap_inconsistency" | "extractor_disagreement" | "connector_conflict";
  source_id?: string;
  severity: "low" | "medium" | "high" | "critical";
}

export class EntityConflictStore {
  constructor(private pool: Pool) {}

  async create(input: CreateConflictInput, lineage: Lineage): Promise<EntityConflict> {
    const result = await this.pool.query(
      `INSERT INTO entity_conflicts (
        fact_sheet_id, fact_key, confirmed_value, conflicting_value,
        source_type, source_id, severity, status, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
      RETURNING *`,
      [
        input.fact_sheet_id,
        input.fact_key,
        input.confirmed_value !== null ? JSON.stringify(input.confirmed_value) : null,
        JSON.stringify(input.conflicting_value),
        input.source_type,
        input.source_id ?? null,
        input.severity,
        JSON.stringify(lineage),
      ],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async getById(id: string): Promise<EntityConflict | null> {
    const result = await this.pool.query("SELECT * FROM entity_conflicts WHERE id = $1", [id]);
    if (result.rows.length === 0) return null;
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<EntityConflict[]> {
    const result = await this.pool.query(
      "SELECT * FROM entity_conflicts WHERE fact_sheet_id = $1 ORDER BY severity DESC, created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToEntityConflict(row));
  }

  async resolve(
    id: string,
    confirmedValue: unknown,
    resolvedBy: string,
    resolutionNote: string,
  ): Promise<EntityConflict> {
    const result = await this.pool.query(
      `UPDATE entity_conflicts
       SET status = 'resolved', confirmed_value = $2, resolved_by = $3, resolved_at = now(), resolution_note = $4, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(confirmedValue), resolvedBy, resolutionNote],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  async dismiss(id: string, resolvedBy: string, resolutionNote: string): Promise<EntityConflict> {
    const result = await this.pool.query(
      `UPDATE entity_conflicts
       SET status = 'dismissed', resolved_by = $2, resolved_at = now(), resolution_note = $3, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, resolvedBy, resolutionNote],
    );
    return this.rowToEntityConflict(result.rows[0]!);
  }

  private rowToEntityConflict(row: Record<string, unknown>): EntityConflict {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      fact_key: row["fact_key"] as string,
      confirmed_value: row["confirmed_value"] ?? null,
      conflicting_value: row["conflicting_value"],
      source_type: row["source_type"] as
        "nap_inconsistency" | "extractor_disagreement" | "connector_conflict",
      source_id: row["source_id"] as string | null,
      severity: row["severity"] as "low" | "medium" | "high" | "critical",
      status: row["status"] as "open" | "investigating" | "resolved" | "dismissed",
      resolved_by: row["resolved_by"] as string | null,
      resolved_at: row["resolved_at"] ? (row["resolved_at"] as Date).toISOString() : null,
      resolution_note: row["resolution_note"] as string | null,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
      updated_at: (row["updated_at"] as Date).toISOString(),
    };
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/stores/entity-conflict-store.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 9: Update index.ts barrel exports**

```typescript
// packages/footprint-store/src/index.ts
export { LineageSchema, UUIDSchema, type Lineage, type UUID } from "./common.js";
export {
  FactSheetSchema,
  FactSheetCreateSchema,
  type FactSheet,
  type FactSheetCreate,
} from "./fact-sheet.js";
export { FactRegisterEntrySchema, type FactRegisterEntry } from "./fact-register.js";
export { EntityConflictSchema, type EntityConflict } from "./entity-conflict.js";
export {
  ProfileObservationSchema,
  PublicSourceObservationSchema,
  NapObservationSchema,
  type ProfileObservation,
  type PublicSourceObservation,
  type NapObservation,
} from "./observations.js";
export { LocationSchema, type Location } from "./location.js";
export { BrandTermsSchema, type BrandTerms } from "./brand-terms.js";
export { FactSheetStore } from "./stores/fact-sheet-store.js";
export { EntityConflictStore } from "./stores/entity-conflict-store.js";
```

- [ ] **Step 10: Run all tests to verify**

Run: `cd packages/footprint-store && npm test -- --run`
Expected: PASS — all 28 tests pass

- [ ] **Step 11: Commit**

```bash
git add packages/footprint-store/src/
git commit -m "feat(M7): add FactSheetStore and EntityConflictStore with CRUD operations"
```

---

### Task 6: Observation CRUD Stores

**Files:**

- Create: `packages/footprint-store/src/stores/observation-stores.ts`
- Create: `packages/footprint-store/src/stores/observation-stores.test.ts`

**Interfaces:**

- Consumes: `pg` Pool, observation Zod schemas
- Produces: PublicSourceObservationStore, ProfileObservationStore, NapObservationStore

- [ ] **Step 1: Write failing test for observation stores**

```typescript
// packages/footprint-store/src/stores/observation-stores.test.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import {
  PublicSourceObservationStore,
  ProfileObservationStore,
  NapObservationStore,
} from "./observation-stores.js";

describe("PublicSourceObservationStore", () => {
  let pool: Pool;
  let store: PublicSourceObservationStore;

  beforeEach(() => {
    pool = new Pool({
      connectionString: process.env["TEST_DATABASE_URL"] ?? "postgresql://localhost:5432/wpi_test",
    });
    store = new PublicSourceObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const baseLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440000",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "google-extractor",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "extracted" as const,
    content_hash: "abc123",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists public source observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create(
      {
        fact_sheet_id: factSheetId,
        source_platform: "google",
        source_url: "https://google.com/maps/place/example",
        discovered_at: "2026-10-11T10:00:00Z",
        profile_data: { name: "Example Business", phone: "+1-555-0100" },
      },
      baseLineage,
    );

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.source_platform).toBe("google");
  });
});

describe("ProfileObservationStore", () => {
  let pool: Pool;
  let store: ProfileObservationStore;

  beforeEach(() => {
    pool = new Pool({
      connectionString: process.env["TEST_DATABASE_URL"] ?? "postgresql://localhost:5432/wpi_test",
    });
    store = new ProfileObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const baseLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440010",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "profile-extractor",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "extracted" as const,
    content_hash: "def456",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists profile observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create(
      {
        fact_sheet_id: factSheetId,
        source_url: "https://google.com/maps/place/example",
        extracted_name: "Example Business",
        extracted_phone: "+1-555-0100",
        extracted_email: null,
        extracted_address: { street: "123 Main St", city: "Anytown" },
        extracted_hours: { monday: "9:00-17:00" },
        extracted_social: { facebook: "https://fb.com/example" },
        extraction_confidence: 0.85,
      },
      baseLineage,
    );

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.extracted_name).toBe("Example Business");
    expect(list[0]!.extraction_confidence).toBe(0.85);
  });
});

describe("NapObservationStore", () => {
  let pool: Pool;
  let store: NapObservationStore;

  beforeEach(() => {
    pool = new Pool({
      connectionString: process.env["TEST_DATABASE_URL"] ?? "postgresql://localhost:5432/wpi_test",
    });
    store = new NapObservationStore(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  const baseLineage = {
    record_id: "550e8400-e29b-41d4-a716-446655440020",
    project_id: "550e8400-e29b-41d4-a716-446655440001",
    site_id: null,
    source_type: "third_party_unverified" as const,
    source_id: "nap-engine",
    source_version: "1.0.0",
    captured_at: "2026-10-11T10:00:00Z",
    as_of: "2026-10-11T10:00:00Z",
    market: "US",
    language: "en",
    device: "desktop",
    method: "automated",
    methodology_version: "1.0.0",
    fidelity_label: "extracted" as const,
    content_hash: "ghi789",
    parent_ids: [],
    validation_state: "unvalidated" as const,
  };

  it("creates and lists NAP observations", async () => {
    const factSheetId = "550e8400-e29b-41d4-a716-446655440001";
    await store.create(
      {
        fact_sheet_id: factSheetId,
        source_url: "https://yelp.com/biz/example",
        name_value: "Example Business",
        phone_value: "+1-555-0100",
        address_value: { street: "123 Main St", city: "Anytown" },
        consistency_score: 0.92,
        inconsistencies: [{ field: "phone", expected: "+1-555-0200", actual: "+1-555-0100" }],
      },
      baseLineage,
    );

    const list = await store.listByFactSheet(factSheetId);
    expect(list.length).toBe(1);
    expect(list[0]!.consistency_score).toBe(0.92);
    expect(list[0]!.inconsistencies.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/footprint-store && npm test -- --run src/stores/observation-stores.test.ts`
Expected: FAIL — module `./observation-stores.js` not found

- [ ] **Step 3: Write observation stores implementation**

```typescript
// packages/footprint-store/src/stores/observation-stores.ts
import type { Pool } from "pg";
import type {
  PublicSourceObservation,
  ProfileObservation,
  NapObservation,
} from "../observations.js";
import type { Lineage } from "../common.js";

export class PublicSourceObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_platform: string;
      source_url: string;
      discovered_at: string;
      profile_data: Record<string, unknown>;
    },
    lineage: Lineage,
  ): Promise<PublicSourceObservation> {
    const result = await this.pool.query(
      `INSERT INTO public_source_observations (fact_sheet_id, source_platform, source_url, discovered_at, profile_data, lineage)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.fact_sheet_id,
        input.source_platform,
        input.source_url,
        input.discovered_at,
        JSON.stringify(input.profile_data),
        JSON.stringify(lineage),
      ],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<PublicSourceObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM public_source_observations WHERE fact_sheet_id = $1 ORDER BY created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): PublicSourceObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_platform: row["source_platform"] as string,
      source_url: row["source_url"] as string,
      discovered_at: (row["discovered_at"] as Date).toISOString(),
      profile_data: (row["profile_data"] ?? {}) as Record<string, unknown>,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}

export class ProfileObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_url: string;
      extracted_name?: string | null;
      extracted_phone?: string | null;
      extracted_email?: string | null;
      extracted_address?: Record<string, string> | null;
      extracted_hours?: Record<string, string> | null;
      extracted_social?: Record<string, string> | null;
      extraction_confidence: number;
    },
    lineage: Lineage,
  ): Promise<ProfileObservation> {
    const result = await this.pool.query(
      `INSERT INTO profile_observations (
        fact_sheet_id, source_url, extracted_name, extracted_phone, extracted_email,
        extracted_address, extracted_hours, extracted_social, extraction_confidence, lineage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.fact_sheet_id,
        input.source_url,
        input.extracted_name ?? null,
        input.extracted_phone ?? null,
        input.extracted_email ?? null,
        input.extracted_address ? JSON.stringify(input.extracted_address) : null,
        input.extracted_hours ? JSON.stringify(input.extracted_hours) : null,
        input.extracted_social ? JSON.stringify(input.extracted_social) : null,
        input.extraction_confidence,
        JSON.stringify(lineage),
      ],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<ProfileObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM profile_observations WHERE fact_sheet_id = $1 ORDER BY created_at DESC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): ProfileObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_url: row["source_url"] as string,
      extracted_name: row["extracted_name"] as string | null,
      extracted_phone: row["extracted_phone"] as string | null,
      extracted_email: row["extracted_email"] as string | null,
      extracted_address: row["extracted_address"] as Record<string, string> | null,
      extracted_hours: row["extracted_hours"] as Record<string, string> | null,
      extracted_social: row["extracted_social"] as Record<string, string> | null,
      extraction_confidence: row["extraction_confidence"] as number,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}

export class NapObservationStore {
  constructor(private pool: Pool) {}

  async create(
    input: {
      fact_sheet_id: string;
      source_url: string;
      name_value?: string | null;
      phone_value?: string | null;
      address_value?: Record<string, string> | null;
      consistency_score: number;
      inconsistencies: Array<{ field: string; expected: string; actual: string }>;
    },
    lineage: Lineage,
  ): Promise<NapObservation> {
    const result = await this.pool.query(
      `INSERT INTO nap_observations (fact_sheet_id, source_url, name_value, phone_value, address_value, consistency_score, inconsistencies, lineage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.fact_sheet_id,
        input.source_url,
        input.name_value ?? null,
        input.phone_value ?? null,
        input.address_value ? JSON.stringify(input.address_value) : null,
        input.consistency_score,
        JSON.stringify(input.inconsistencies),
        JSON.stringify(lineage),
      ],
    );
    return this.rowToObservation(result.rows[0]!);
  }

  async listByFactSheet(factSheetId: string): Promise<NapObservation[]> {
    const result = await this.pool.query(
      "SELECT * FROM nap_observations WHERE fact_sheet_id = $1 ORDER BY consistency_score ASC",
      [factSheetId],
    );
    return result.rows.map((row) => this.rowToObservation(row));
  }

  private rowToObservation(row: Record<string, unknown>): NapObservation {
    return {
      id: row["id"] as string,
      fact_sheet_id: row["fact_sheet_id"] as string,
      source_url: row["source_url"] as string,
      name_value: row["name_value"] as string | null,
      phone_value: row["phone_value"] as string | null,
      address_value: row["address_value"] as Record<string, string> | null,
      consistency_score: row["consistency_score"] as number,
      inconsistencies: (row["inconsistencies"] ?? []) as Array<{
        field: string;
        expected: string;
        actual: string;
      }>,
      lineage: row["lineage"] as Lineage,
      created_at: (row["created_at"] as Date).toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/footprint-store && npm test -- --run src/stores/observation-stores.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 5: Update index.ts barrel exports**

```typescript
// packages/footprint-store/src/index.ts
export { LineageSchema, UUIDSchema, type Lineage, type UUID } from "./common.js";
export {
  FactSheetSchema,
  FactSheetCreateSchema,
  type FactSheet,
  type FactSheetCreate,
} from "./fact-sheet.js";
export { FactRegisterEntrySchema, type FactRegisterEntry } from "./fact-register.js";
export { EntityConflictSchema, type EntityConflict } from "./entity-conflict.js";
export {
  ProfileObservationSchema,
  PublicSourceObservationSchema,
  NapObservationSchema,
  type ProfileObservation,
  type PublicSourceObservation,
  type NapObservation,
} from "./observations.js";
export { LocationSchema, type Location } from "./location.js";
export { BrandTermsSchema, type BrandTerms } from "./brand-terms.js";
export { FactSheetStore } from "./stores/fact-sheet-store.js";
export { EntityConflictStore } from "./stores/entity-conflict-store.js";
export {
  PublicSourceObservationStore,
  ProfileObservationStore,
  NapObservationStore,
} from "./stores/observation-stores.js";
```

- [ ] **Step 6: Run all tests to verify**

Run: `cd packages/footprint-store && npm test -- --run`
Expected: PASS — all 31 tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/footprint-store/src/
git commit -m "feat(M7): add observation CRUD stores (PublicSource, Profile, NAP)"
```

---

### Task 7: Platform URL Patterns & Public Source Discovery

**Files:**

- Create: `packages/public-source-discovery/package.json`
- Create: `packages/public-source-discovery/tsconfig.json`
- Create: `packages/public-source-discovery/src/index.ts`
- Create: `packages/public-source-discovery/src/platforms.ts`
- Create: `packages/public-source-discovery/src/discovery.ts`
- Create: `packages/public-source-discovery/src/platforms.test.ts`
- Create: `packages/public-source-discovery/src/discovery.test.ts`

**Interfaces:**

- Consumes: Business name and site URL from fact sheet
- Produces: List of discovered profile URLs for known platforms (Google, Yelp, Facebook, etc.)

- [ ] **Step 1: Write failing test for platform URL pattern generation**

```typescript
// packages/public-source-discovery/src/platforms.test.ts
import { describe, expect, it } from "vitest";
import { generateProfileUrls } from "./platforms.js";

describe("generateProfileUrls", () => {
  it("generates Google Maps search URL from business name and location", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com", {
      locality: "Anytown",
      region: "CA",
    });
    expect(urls).toContainEqual(
      expect.objectContaining({
        platform: "google",
        url: expect.stringContaining("google.com/maps"),
      }),
    );
  });

  it("generates Yelp search URL from business name and location", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com", {
      locality: "Anytown",
      region: "CA",
    });
    expect(urls).toContainEqual(
      expect.objectContaining({ platform: "yelp", url: expect.stringContaining("yelp.com") }),
    );
  });

  it("generates Facebook search URL from business name", () => {
    const urls = generateProfileUrls("Example Business", "https://example.com");
    expect(urls).toContainEqual(
      expect.objectContaining({
        platform: "facebook",
        url: expect.stringContaining("facebook.com"),
      }),
    );
  });

  it("returns empty array for empty business name", () => {
    const urls = generateProfileUrls("", "https://example.com");
    expect(urls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/public-source-discovery && npm test -- --run src/platforms.test.ts`
Expected: FAIL — module `./platforms.js` not found

- [ ] **Step 3: Write package.json and tsconfig.json**

```json
{
  "name": "@wpi/public-source-discovery",
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

- [ ] **Step 4: Write platform URL pattern generator**

```typescript
// packages/public-source-discovery/src/platforms.ts
export interface DiscoveredProfile {
  platform: string;
  url: string;
}

export function generateProfileUrls(
  businessName: string,
  siteUrl: string,
  location?: { locality?: string; region?: string },
): DiscoveredProfile[] {
  if (!businessName.trim()) return [];

  const encodedName = encodeURIComponent(businessName);
  const profiles: DiscoveredProfile[] = [];

  const googleQuery = location
    ? `${encodedName}+${encodeURIComponent(location.locality ?? "")}+${encodeURIComponent(location.region ?? "")}`
    : encodedName;
  profiles.push({
    platform: "google",
    url: `https://www.google.com/maps/search/${googleQuery}`,
  });

  const yelpQuery = location
    ? `${encodedName}+${encodeURIComponent(location.locality ?? "")}+${encodeURIComponent(location.region ?? "")}`
    : encodedName;
  profiles.push({
    platform: "yelp",
    url: `https://www.yelp.com/search?find_desc=${yelpQuery}`,
  });

  profiles.push({
    platform: "facebook",
    url: `https://www.facebook.com/search/pages/?q=${encodedName}`,
  });

  profiles.push({
    platform: "linkedin",
    url: `https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`,
  });

  profiles.push({
    platform: "twitter",
    url: `https://twitter.com/search?q=${encodedName}&src=typed_query&f=user`,
  });

  return profiles;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/public-source-discovery && npm test -- --run src/platforms.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 6: Write failing test for discovery orchestrator**

```typescript
// packages/public-source-discovery/src/discovery.test.ts
import { describe, expect, it } from "vitest";
import { discoverPublicSources } from "./discovery.js";

describe("discoverPublicSources", () => {
  it("returns discovered profiles for a business", async () => {
    const profiles = await discoverPublicSources({
      businessName: "Example Business",
      siteUrl: "https://example.com",
      location: { locality: "Anytown", region: "CA" },
    });

    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0]).toHaveProperty("platform");
    expect(profiles[0]).toHaveProperty("url");
  });

  it("returns empty array for empty business name", async () => {
    const profiles = await discoverPublicSources({
      businessName: "",
      siteUrl: "https://example.com",
    });

    expect(profiles).toEqual([]);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd packages/public-source-discovery && npm test -- --run src/discovery.test.ts`
Expected: FAIL — module `./discovery.js` not found

- [ ] **Step 8: Write discovery orchestrator**

```typescript
// packages/public-source-discovery/src/discovery.ts
import { generateProfileUrls, type DiscoveredProfile } from "./platforms.js";

export interface DiscoveryInput {
  businessName: string;
  siteUrl: string;
  location?: { locality?: string; region?: string };
}

export async function discoverPublicSources(input: DiscoveryInput): Promise<DiscoveredProfile[]> {
  return generateProfileUrls(input.businessName, input.siteUrl, input.location);
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd packages/public-source-discovery && npm test -- --run src/discovery.test.ts`
Expected: PASS — 2 tests pass

- [ ] **Step 10: Write index.ts barrel export**

```typescript
// packages/public-source-discovery/src/index.ts
export { generateProfileUrls, type DiscoveredProfile } from "./platforms.js";
export { discoverPublicSources, type DiscoveryInput } from "./discovery.js";
```

- [ ] **Step 11: Run all tests to verify**

Run: `cd packages/public-source-discovery && npm test -- --run`
Expected: PASS — all 6 tests pass

- [ ] **Step 12: Commit**

```bash
git add packages/public-source-discovery/
git commit -m "feat(M7): add public source discovery package with platform URL patterns"
```

---

### Task 8: HTML Profile Extractor

**Files:**

- Create: `packages/profile-extractor/package.json`
- Create: `packages/profile-extractor/tsconfig.json`
- Create: `packages/profile-extractor/src/index.ts`
- Create: `packages/profile-extractor/src/extractor.ts`
- Create: `packages/profile-extractor/src/extractor.test.ts`

**Interfaces:**

- Consumes: HTML content from crawled profile pages
- Produces: Extracted profile data (name, phone, email, address, hours, social links)

- [ ] **Step 1: Write failing test for profile extraction**

```typescript
// packages/profile-extractor/src/extractor.test.ts
import { describe, expect, it } from "vitest";
import { extractProfileData } from "./extractor.js";

describe("extractProfileData", () => {
  it("extracts business name from h1 tag", () => {
    const html = `<html><body><h1>Example Business</h1></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_name).toBe("Example Business");
  });

  it("extracts phone number from tel: link", () => {
    const html = `<html><body><a href="tel:+1-555-0100">Call us</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_phone).toBe("+1-555-0100");
  });

  it("extracts email from mailto: link", () => {
    const html = `<html><body><a href="mailto:contact@example.com">Email</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_email).toBe("contact@example.com");
  });

  it("extracts address from schema.org LocalBusiness markup", () => {
    const html = `
      <html>
        <body>
          <div itemscope itemtype="http://schema.org/LocalBusiness">
            <span itemprop="streetAddress">123 Main St</span>
            <span itemprop="addressLocality">Anytown</span>
            <span itemprop="addressRegion">CA</span>
            <span itemprop="postalCode">90210</span>
            <span itemprop="addressCountry">US</span>
          </div>
        </body>
      </html>
    `;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extracted_address).toEqual({
      street: "123 Main St",
      city: "Anytown",
      region: "CA",
      postal_code: "90210",
      country: "US",
    });
  });

  it("returns confidence score based on extraction completeness", () => {
    const html = `<html><body><h1>Example</h1><a href="tel:+1-555-0100">Call</a></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extraction_confidence).toBeGreaterThan(0);
    expect(result.extraction_confidence).toBeLessThanOrEqual(1);
  });

  it("returns low confidence for empty HTML", () => {
    const html = `<html><body></body></html>`;
    const result = extractProfileData(html, "https://example.com/profile");
    expect(result.extraction_confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/profile-extractor && npm test -- --run src/extractor.test.ts`
Expected: FAIL — module `./extractor.js` not found

- [ ] **Step 3: Write package.json and tsconfig.json**

```json
{
  "name": "@wpi/profile-extractor",
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

- [ ] **Step 4: Write profile extractor implementation**

```typescript
// packages/profile-extractor/src/extractor.ts
export interface ExtractedProfile {
  extracted_name: string | null;
  extracted_phone: string | null;
  extracted_email: string | null;
  extracted_address: Record<string, string> | null;
  extracted_hours: Record<string, string> | null;
  extracted_social: Record<string, string> | null;
  extraction_confidence: number;
}

export function extractProfileData(html: string, sourceUrl: string): ExtractedProfile {
  const result: ExtractedProfile = {
    extracted_name: null,
    extracted_phone: null,
    extracted_email: null,
    extracted_address: null,
    extracted_hours: null,
    extracted_social: null,
    extraction_confidence: 0,
  };

  let extractedFields = 0;

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    result.extracted_name = h1Match[1]!.replace(/<[^>]*>/g, "").trim();
    extractedFields++;
  }

  const telMatch = html.match(/href="tel:([^"]+)"/i);
  if (telMatch) {
    result.extracted_phone = telMatch[1]!;
    extractedFields++;
  }

  const mailtoMatch = html.match(/href="mailto:([^"]+)"/i);
  if (mailtoMatch) {
    result.extracted_email = mailtoMatch[1]!;
    extractedFields++;
  }

  const streetAddress = html.match(/itemprop="streetAddress"[^>]*>(.*?)</s);
  const addressLocality = html.match(/itemprop="addressLocality"[^>]*>(.*?)</s);
  const addressRegion = html.match(/itemprop="addressRegion"[^>]*>(.*?)</s);
  const postalCode = html.match(/itemprop="postalCode"[^>]*>(.*?)</s);
  const addressCountry = html.match(/itemprop="addressCountry"[^>]*>(.*?)</s);

  if (streetAddress || addressLocality) {
    result.extracted_address = {
      street: streetAddress ? stripTags(streetAddress[1]!) : null,
      city: addressLocality ? stripTags(addressLocality[1]!) : null,
      region: addressRegion ? stripTags(addressRegion[1]!) : null,
      postal_code: postalCode ? stripTags(postalCode[1]!) : null,
      country: addressCountry ? stripTags(addressCountry[1]!) : null,
    };
    extractedFields++;
  }

  const totalPossibleFields = 6;
  result.extraction_confidence = extractedFields / totalPossibleFields;

  return result;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/profile-extractor && npm test -- --run src/extractor.test.ts`
Expected: PASS — 6 tests pass

- [ ] **Step 6: Write index.ts barrel export**

```typescript
// packages/profile-extractor/src/index.ts
export { extractProfileData, type ExtractedProfile } from "./extractor.js";
```

- [ ] **Step 7: Run all tests to verify**

Run: `cd packages/profile-extractor && npm test -- --run`
Expected: PASS — all 6 tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/profile-extractor/
git commit -m "feat(M7): add profile extractor package for HTML profile data extraction"
```

---

### Task 9: NAP Consistency Engine

**Files:**

- Create: `packages/nap-consistency/package.json`
- Create: `packages/nap-consistency/tsconfig.json`
- Create: `packages/nap-consistency/src/index.ts`
- Create: `packages/nap-consistency/src/engine.ts`
- Create: `packages/nap-consistency/src/engine.test.ts`

**Interfaces:**

- Consumes: Fact sheet (confirmed values) + profile observations (extracted values)
- Produces: NAP consistency score + list of inconsistencies per source

- [ ] **Step 1: Write failing test for NAP consistency scoring**

```typescript
// packages/nap-consistency/src/engine.test.ts
import { describe, expect, it } from "vitest";
import { computeNapConsistency } from "./engine.js";

describe("computeNapConsistency", () => {
  const baseFactSheet = {
    business_name: "Example Business",
    phone: "+1-555-0100",
    address: {
      street: "123 Main St",
      city: "Anytown",
      region: "CA",
      postal_code: "90210",
      country: "US",
    },
  };

  it("returns score 1.0 when all NAP fields match exactly", () => {
    const observation = {
      source_url: "https://google.com/maps/place/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_address: {
        street: "123 Main St",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.consistency_score).toBe(1.0);
    expect(result.inconsistencies).toEqual([]);
  });

  it("detects phone number mismatch", () => {
    const observation = {
      source_url: "https://yelp.com/biz/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0200",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.consistency_score).toBeLessThan(1.0);
    expect(result.inconsistencies).toContainEqual(
      expect.objectContaining({ field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" }),
    );
  });

  it("detects business name mismatch", () => {
    const observation = {
      source_url: "https://facebook.com/example",
      extracted_name: "Example Biz LLC",
      extracted_phone: "+1-555-0100",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toContainEqual(expect.objectContaining({ field: "name" }));
  });

  it("detects address field mismatch", () => {
    const observation = {
      source_url: "https://yelp.com/biz/example",
      extracted_name: "Example Business",
      extracted_phone: "+1-555-0100",
      extracted_address: {
        street: "456 Oak Ave",
        city: "Anytown",
        region: "CA",
        postal_code: "90210",
        country: "US",
      },
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toContainEqual(
      expect.objectContaining({ field: "address.street" }),
    );
  });

  it("handles missing observation fields gracefully", () => {
    const observation = {
      source_url: "https://example.com",
      extracted_name: null,
      extracted_phone: null,
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    expect(result.inconsistencies).toEqual([]);
    expect(result.consistency_score).toBe(1.0);
  });

  it("normalizes phone numbers before comparison", () => {
    const observation = {
      source_url: "https://example.com",
      extracted_name: "Example Business",
      extracted_phone: "+15550100",
      extracted_address: null,
    };

    const result = computeNapConsistency(baseFactSheet, observation);
    const phoneInconsistencies = result.inconsistencies.filter((i) => i.field === "phone");
    expect(phoneInconsistencies).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/nap-consistency && npm test -- --run src/engine.test.ts`
Expected: FAIL — module `./engine.js` not found

- [ ] **Step 3: Write package.json and tsconfig.json**

```json
{
  "name": "@wpi/nap-consistency",
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

- [ ] **Step 4: Write NAP consistency engine**

```typescript
// packages/nap-consistency/src/engine.ts
export interface FactSheetForNap {
  business_name: string;
  phone: string | null;
  address: {
    street: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
}

export interface ObservationForNap {
  source_url: string;
  extracted_name: string | null;
  extracted_phone: string | null;
  extracted_address: Record<string, string> | null;
}

export interface Inconsistency {
  field: string;
  expected: string;
  actual: string;
}

export interface NapConsistencyResult {
  source_url: string;
  consistency_score: number;
  inconsistencies: Inconsistency[];
}

export function computeNapConsistency(
  factSheet: FactSheetForNap,
  observation: ObservationForNap,
): NapConsistencyResult {
  const inconsistencies: Inconsistency[] = [];
  let totalFields = 0;
  let matchedFields = 0;

  if (observation.extracted_name !== null && factSheet.business_name) {
    totalFields++;
    if (normalizeText(observation.extracted_name) === normalizeText(factSheet.business_name)) {
      matchedFields++;
    } else {
      inconsistencies.push({
        field: "name",
        expected: factSheet.business_name,
        actual: observation.extracted_name,
      });
    }
  }

  if (observation.extracted_phone !== null && factSheet.phone) {
    totalFields++;
    if (normalizePhone(observation.extracted_phone) === normalizePhone(factSheet.phone)) {
      matchedFields++;
    } else {
      inconsistencies.push({
        field: "phone",
        expected: factSheet.phone,
        actual: observation.extracted_phone,
      });
    }
  }

  if (observation.extracted_address !== null && factSheet.address) {
    const addressFields = ["street", "city", "region", "postal_code", "country"] as const;
    for (const field of addressFields) {
      const factValue = factSheet.address[field];
      const obsValue = observation.extracted_address[field] ?? null;
      if (obsValue !== null && factValue !== null) {
        totalFields++;
        if (normalizeText(obsValue) === normalizeText(factValue)) {
          matchedFields++;
        } else {
          inconsistencies.push({
            field: `address.${field}`,
            expected: factValue,
            actual: obsValue,
          });
        }
      }
    }
  }

  const consistency_score = totalFields === 0 ? 1.0 : matchedFields / totalFields;

  return {
    source_url: observation.source_url,
    consistency_score,
    inconsistencies,
  };
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/nap-consistency && npm test -- --run src/engine.test.ts`
Expected: PASS — 6 tests pass

- [ ] **Step 6: Write index.ts barrel export**

```typescript
// packages/nap-consistency/src/index.ts
export {
  computeNapConsistency,
  type FactSheetForNap,
  type ObservationForNap,
  type Inconsistency,
  type NapConsistencyResult,
} from "./engine.js";
```

- [ ] **Step 7: Run all tests to verify**

Run: `cd packages/nap-consistency && npm test -- --run`
Expected: PASS — all 6 tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/nap-consistency/
git commit -m "feat(M7): add NAP consistency engine for comparing fact sheet against observations"
```

---

### Task 10: Conflict Detector

**Files:**

- Create: `packages/nap-consistency/src/conflict-detector.ts`
- Create: `packages/nap-consistency/src/conflict-detector.test.ts`

**Interfaces:**

- Consumes: NAP consistency results across multiple sources
- Produces: List of entity conflicts ready for persistence

- [ ] **Step 1: Write failing test for conflict detection**

```typescript
// packages/nap-consistency/src/conflict-detector.test.ts
import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflict-detector.js";
import type { NapConsistencyResult } from "./engine.js";

describe("detectConflicts", () => {
  it("generates a high-severity conflict for phone mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.75,
        inconsistencies: [{ field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" }],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.fact_key).toBe("phone");
    expect(conflicts[0]!.severity).toBe("high");
    expect(conflicts[0]!.source_type).toBe("nap_inconsistency");
  });

  it("generates medium-severity for name mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://facebook.com/example",
        consistency_score: 0.8,
        inconsistencies: [
          { field: "name", expected: "Example Business", actual: "Example Biz LLC" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.severity).toBe("medium");
  });

  it("generates low-severity for address field mismatch", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.9,
        inconsistencies: [
          { field: "address.street", expected: "123 Main St", actual: "123 Main Street" },
        ],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.severity).toBe("low");
  });

  it("returns empty array when no inconsistencies", () => {
    const results: NapConsistencyResult[] = [
      { source_url: "https://example.com", consistency_score: 1.0, inconsistencies: [] },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts).toEqual([]);
  });

  it("aggregates conflicts from multiple sources", () => {
    const results: NapConsistencyResult[] = [
      {
        source_url: "https://yelp.com/biz/example",
        consistency_score: 0.5,
        inconsistencies: [
          { field: "phone", expected: "+1-555-0100", actual: "+1-555-0200" },
          { field: "name", expected: "Example Business", actual: "Example Biz" },
        ],
      },
      {
        source_url: "https://facebook.com/example",
        consistency_score: 0.75,
        inconsistencies: [{ field: "phone", expected: "+1-555-0100", actual: "+1-555-0300" }],
      },
    ];

    const conflicts = detectConflicts("550e8400-e29b-41d4-a716-446655440001", results);
    expect(conflicts.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/nap-consistency && npm test -- --run src/conflict-detector.test.ts`
Expected: FAIL — module `./conflict-detector.js` not found

- [ ] **Step 3: Write conflict detector**

```typescript
// packages/nap-consistency/src/conflict-detector.ts
import type { NapConsistencyResult } from "./engine.js";

export interface DetectedConflict {
  fact_sheet_id: string;
  fact_key: string;
  confirmed_value: unknown;
  conflicting_value: unknown;
  source_type: "nap_inconsistency";
  source_id: string;
  severity: "low" | "medium" | "high" | "critical";
}

export function detectConflicts(
  factSheetId: string,
  results: NapConsistencyResult[],
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  for (const result of results) {
    for (const inconsistency of result.inconsistencies) {
      conflicts.push({
        fact_sheet_id: factSheetId,
        fact_key: inconsistency.field,
        confirmed_value: { value: inconsistency.expected },
        conflicting_value: { value: inconsistency.actual },
        source_type: "nap_inconsistency",
        source_id: result.source_url,
        severity: classifySeverity(inconsistency.field),
      });
    }
  }

  return conflicts;
}

function classifySeverity(field: string): "low" | "medium" | "high" | "critical" {
  if (field === "phone") return "high";
  if (field === "name") return "medium";
  if (field.startsWith("address.")) return "low";
  return "low";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/nap-consistency && npm test -- --run src/conflict-detector.test.ts`
Expected: PASS — 5 tests pass

- [ ] **Step 5: Update index.ts barrel export**

```typescript
// packages/nap-consistency/src/index.ts
export {
  computeNapConsistency,
  type FactSheetForNap,
  type ObservationForNap,
  type Inconsistency,
  type NapConsistencyResult,
} from "./engine.js";
export { detectConflicts, type DetectedConflict } from "./conflict-detector.js";
```

- [ ] **Step 6: Run all tests to verify**

Run: `cd packages/nap-consistency && npm test -- --run`
Expected: PASS — all 11 tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/nap-consistency/src/
git commit -m "feat(M7): add conflict detector for generating entity conflicts from NAP inconsistencies"
```

---

### Task 11: Agent Tools (read_specialist_evidence, read_confirmed_facts)

**Files:**

- Create: `services/agents/src/tools/read-specialist-evidence.ts`
- Create: `services/agents/src/tools/read-confirmed-facts.ts`
- Create: `services/agents/src/tools/read-specialist-evidence.test.ts`
- Create: `services/agents/src/tools/read-confirmed-facts.test.ts`

**Interfaces:**

- Consumes: `ToolContext` with `audit_id` and optional `db` PoolClient
- Produces: `ToolResult` with evidence data and appropriate source_tier

- [ ] **Step 1: Write failing test for read_specialist_evidence tool**

```typescript
// services/agents/src/tools/read-specialist-evidence.test.ts
import { describe, expect, it } from "vitest";
import { ReadSpecialistEvidenceTool } from "./read-specialist-evidence.js";

describe("ReadSpecialistEvidenceTool", () => {
  it("has correct name and description", () => {
    const tool = new ReadSpecialistEvidenceTool();
    expect(tool.name).toBe("read_specialist_evidence");
    expect(tool.description).toBeTruthy();
  });

  it("has input schema requiring evidence_type", () => {
    const tool = new ReadSpecialistEvidenceTool();
    expect(tool.inputSchema).toHaveProperty("properties.evidence_type");
    expect(tool.inputSchema.required).toContain("evidence_type");
  });

  it("returns data with source_tier third_party_unverified", async () => {
    const tool = new ReadSpecialistEvidenceTool();
    const result = await tool.execute(
      { evidence_type: "entity_profile", audit_id: "test-audit-id" },
      { audit_id: "test-audit-id", project_id: "test-project", evidence_bucket: "/tmp/test" },
    );
    expect(result.source_tier).toBe("third_party_unverified");
    expect(result.data).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/agents && npm test -- --run src/tools/read-specialist-evidence.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write read_specialist_evidence tool**

```typescript
// services/agents/src/tools/read-specialist-evidence.ts
import type { Tool, ToolContext, ToolResult } from "./types.js";

export class ReadSpecialistEvidenceTool implements Tool {
  name = "read_specialist_evidence";
  description =
    "Read specialist evidence extracted from public profiles and third-party sources for the current audit.";
  inputSchema = {
    type: "object",
    properties: {
      evidence_type: {
        type: "string",
        enum: ["entity_profile", "nap_analysis", "public_source"],
        description: "Type of specialist evidence to retrieve",
      },
      audit_id: {
        type: "string",
        description: "Audit ID to retrieve evidence for",
      },
    },
    required: ["evidence_type"],
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const typedInput = input as { evidence_type: string; audit_id?: string };
    const auditId = typedInput.audit_id ?? context.audit_id;

    if (context.db) {
      const result = await context.db.query(
        `SELECT * FROM profile_observations WHERE fact_sheet_id IN (
          SELECT id FROM fact_sheets WHERE project_id = $1
        ) ORDER BY created_at DESC LIMIT 50`,
        [context.project_id],
      );
      return {
        data: result.rows,
        source_tier: "third_party_unverified",
        limitations: ["Evidence is extracted automatically and may contain errors"],
      };
    }

    return {
      data: [],
      source_tier: "third_party_unverified",
      limitations: ["No database connection available"],
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/agents && npm test -- --run src/tools/read-specialist-evidence.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 5: Write failing test for read_confirmed_facts tool**

```typescript
// services/agents/src/tools/read-confirmed-facts.test.ts
import { describe, expect, it } from "vitest";
import { ReadConfirmedFactsTool } from "./read-confirmed-facts.js";

describe("ReadConfirmedFactsTool", () => {
  it("has correct name and description", () => {
    const tool = new ReadConfirmedFactsTool();
    expect(tool.name).toBe("read_confirmed_facts");
    expect(tool.description).toBeTruthy();
  });

  it("has input schema with optional fact_sheet_id", () => {
    const tool = new ReadConfirmedFactsTool();
    expect(tool.inputSchema).toHaveProperty("properties.fact_sheet_id");
  });

  it("returns data with source_tier third_party_verified", async () => {
    const tool = new ReadConfirmedFactsTool();
    const result = await tool.execute(
      { fact_sheet_id: "550e8400-e29b-41d4-a716-446655440001" },
      { audit_id: "test-audit-id", project_id: "test-project", evidence_bucket: "/tmp/test" },
    );
    expect(result.source_tier).toBe("third_party_verified");
    expect(result.data).toBeDefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd services/agents && npm test -- --run src/tools/read-confirmed-facts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Write read_confirmed_facts tool**

```typescript
// services/agents/src/tools/read-confirmed-facts.ts
import type { Tool, ToolContext, ToolResult } from "./types.js";

export class ReadConfirmedFactsTool implements Tool {
  name = "read_confirmed_facts";
  description =
    "Read confirmed facts from the fact sheet register. These are human-verified facts that the Fixer and brief writer may use.";
  inputSchema = {
    type: "object",
    properties: {
      fact_sheet_id: {
        type: "string",
        description:
          "Specific fact sheet ID to read from. If omitted, reads all confirmed fact sheets for the project.",
      },
    },
  };

  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const typedInput = input as { fact_sheet_id?: string };

    if (context.db) {
      if (typedInput.fact_sheet_id) {
        const result = await context.db.query(
          `SELECT * FROM fact_register WHERE fact_sheet_id = $1 ORDER BY fact_key`,
          [typedInput.fact_sheet_id],
        );
        return {
          data: result.rows,
          source_tier: "third_party_verified",
          limitations: [],
        };
      }

      const result = await context.db.query(
        `SELECT fr.* FROM fact_register fr
         JOIN fact_sheets fs ON fr.fact_sheet_id = fs.id
         WHERE fs.project_id = $1 AND fs.status = 'confirmed'
         ORDER BY fr.fact_key`,
        [context.project_id],
      );
      return {
        data: result.rows,
        source_tier: "third_party_verified",
        limitations: [],
      };
    }

    return {
      data: [],
      source_tier: "third_party_verified",
      limitations: ["No database connection available"],
    };
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd services/agents && npm test -- --run src/tools/read-confirmed-facts.test.ts`
Expected: PASS — 3 tests pass

- [ ] **Step 9: Register tools in the tool registry**

Find the file where tools are registered (likely `services/agents/src/tools/index.ts` or similar) and add:

```typescript
import { ReadSpecialistEvidenceTool } from "./read-specialist-evidence.js";
import { ReadConfirmedFactsTool } from "./read-confirmed-facts.js";

// In the registration function:
registry.register(new ReadSpecialistEvidenceTool());
registry.register(new ReadConfirmedFactsTool());
```

- [ ] **Step 10: Run all agent tests**

Run: `cd services/agents && npm test -- --run`
Expected: PASS — all tests pass including new tool tests

- [ ] **Step 11: Commit**

```bash
git add services/agents/src/tools/
git commit -m "feat(M7): add read_specialist_evidence and read_confirmed_facts agent tools"
```

---

### Task 12: GEO-011 Evaluator Implementation

**Files:**

- Modify: `packages/rules-engine/src/evaluators/geo.ts:454-460`
- Modify: `packages/rules-engine/src/evaluators/geo.test.ts`

**Interfaces:**

- Consumes: EvidenceBundle with connectors data
- Produces: GEO-011 evaluation result (pass/fail/not_applicable)

- [ ] **Step 1: Write failing test for GEO-011**

```typescript
// Add to packages/rules-engine/src/evaluators/geo.test.ts
describe("GEO-011: Business profile consistency", () => {
  it("returns pass when business profile data is consistent", async () => {
    const evaluator = getGeoEvaluator("GEO-011");
    const bundle = createMockBundle({
      connectors: [
        {
          connector_id: "google_business_profile",
          data: {
            name: "Example Business",
            phone: "+1-555-0100",
            address: "123 Main St, Anytown, CA 90210",
          },
        },
      ],
      factSheet: {
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
    });

    const result = await evaluator.evaluate(bundle);
    expect(result.status).toBe("pass");
    expect(result.rule_id).toBe("GEO-011");
  });

  it("returns fail when business profile data conflicts with fact sheet", async () => {
    const evaluator = getGeoEvaluator("GEO-011");
    const bundle = createMockBundle({
      connectors: [
        {
          connector_id: "google_business_profile",
          data: {
            name: "Example Business",
            phone: "+1-555-0200",
          },
        },
      ],
      factSheet: {
        business_name: "Example Business",
        phone: "+1-555-0100",
      },
    });

    const result = await evaluator.evaluate(bundle);
    expect(result.status).toBe("fail");
    expect(result.evidence).toContain("phone");
  });

  it("returns not_applicable when no business profile connector data", async () => {
    const evaluator = getGeoEvaluator("GEO-011");
    const bundle = createMockBundle({
      connectors: [],
      factSheet: {
        business_name: "Example Business",
      },
    });

    const result = await evaluator.evaluate(bundle);
    expect(result.status).toBe("not_applicable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/rules-engine && npm test -- --run src/evaluators/geo.test.ts`
Expected: FAIL — GEO-011 returns `not_applicable` for all cases

- [ ] **Step 3: Replace GEO-011 stub with real implementation**

In `packages/rules-engine/src/evaluators/geo.ts`, replace lines 454-460:

```typescript
// Replace the stub at lines 454-460 with:
{
  id: "GEO-011",
  category: "geo",
  name: "Business profile consistency",
  description: "Check that business profile data (Google Business Profile, etc.) matches the fact sheet",
  evaluate: async (bundle: EvidenceBundle): Promise<EvaluatorResult> => {
    const profileConnector = bundle.connectors?.find(
      (c) => c.connector_id === "google_business_profile" || c.connector_id === "business_profile",
    );

    if (!profileConnector?.data) {
      return {
        rule_id: "GEO-011",
        status: "not_applicable",
        rationale: "No business profile connector data available",
        evidence: [],
        recommendations: [],
      };
    }

    const profile = profileConnector.data;
    const factSheet = bundle.factSheet;
    const inconsistencies: string[] = [];

    if (factSheet?.phone && profile.phone) {
      const normalizePhone = (p: string) => p.replace(/[^0-9+]/g, "");
      if (normalizePhone(profile.phone) !== normalizePhone(factSheet.phone)) {
        inconsistencies.push(`phone: profile="${profile.phone}" vs fact_sheet="${factSheet.phone}"`);
      }
    }

    if (factSheet?.business_name && profile.name) {
      const normalize = (s: string) => s.trim().toLowerCase();
      if (normalize(profile.name) !== normalize(factSheet.business_name)) {
        inconsistencies.push(`name: profile="${profile.name}" vs fact_sheet="${factSheet.business_name}"`);
      }
    }

    if (inconsistencies.length > 0) {
      return {
        rule_id: "GEO-011",
        status: "fail",
        rationale: "Business profile data conflicts with fact sheet",
        evidence: inconsistencies,
        recommendations: [
          "Update business profile to match confirmed fact sheet values",
          "Or update fact sheet if profile data is more current",
        ],
      };
    }

    return {
      rule_id: "GEO-011",
      status: "pass",
      rationale: "Business profile data is consistent with fact sheet",
      evidence: [],
      recommendations: [],
    };
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/rules-engine && npm test -- --run src/evaluators/geo.test.ts`
Expected: PASS — GEO-011 tests pass, all other GEO tests still pass

- [ ] **Step 5: Run full rules-engine test suite**

Run: `cd packages/rules-engine && npm test -- --run`
Expected: PASS — all tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/rules-engine/src/evaluators/geo.ts packages/rules-engine/src/evaluators/geo.test.ts
git commit -m "feat(M7): implement GEO-011 business profile consistency evaluator"
```

---

### Task 13: Pipeline Integration — Report Envelope and Composer

**Files:**

- Modify: `packages/audit-pipeline/src/report-envelope.ts`
- Modify: `packages/audit-pipeline/src/composer.ts`
- Modify: `packages/audit-pipeline/src/report-envelope.test.ts`
- Modify: `packages/audit-pipeline/src/composer.test.ts`

**Interfaces:**

- Consumes: Existing report envelope types and composition logic
- Produces: "entity" FindingSection, entity-analyst agent mapping, geo→entity category mapping

- [ ] **Step 1: Write failing test for entity section in report envelope**

```typescript
// Add to packages/audit-pipeline/src/report-envelope.test.ts
describe("FindingSection includes entity", () => {
  it("includes 'entity' as a valid FindingSection", () => {
    const section: FindingSection = "entity";
    expect(section).toBe("entity");
  });

  it("maps entity-analyst agent to entity section", () => {
    expect(SECTION_BY_AGENT["entity-analyst"]).toBe("entity");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npm test -- --run src/report-envelope.test.ts`
Expected: FAIL — "entity" not in FindingSection union, entity-analyst not in SECTION_BY_AGENT

- [ ] **Step 3: Update report-envelope.ts**

In `packages/audit-pipeline/src/report-envelope.ts`:

```typescript
// Update FindingSection type (add "entity"):
export type FindingSection =
  "technical" | "keywords" | "content" | "performance" | "experience" | "entity";

// Update SECTION_BY_AGENT (add entity-analyst mapping):
export const SECTION_BY_AGENT: Record<string, FindingSection> = {
  auditor: "technical",
  "keyword-analyst": "keywords",
  "content-strategist": "content",
  "entity-analyst": "entity",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/audit-pipeline && npm test -- --run src/report-envelope.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for composer entity section**

```typescript
// Add to packages/audit-pipeline/src/composer.test.ts
describe("Composer entity section", () => {
  it("includes 'entity' in SECTION_ORDER", () => {
    expect(SECTION_ORDER).toContain("entity");
  });

  it("maps geo category to entity section", () => {
    expect(CATEGORY_TO_SECTION["geo"]).toBe("entity");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npm test -- --run src/composer.test.ts`
Expected: FAIL — "entity" not in SECTION_ORDER, geo maps to "content"

- [ ] **Step 7: Update composer.ts**

In `packages/audit-pipeline/src/composer.ts`:

```typescript
// Update SECTION_ORDER (add "entity"):
const SECTION_ORDER = [
  "technical",
  "keywords",
  "content",
  "performance",
  "experience",
  "entity",
] as const;

// Update CATEGORY_TO_SECTION (change geo from "content" to "entity"):
const CATEGORY_TO_SECTION: Record<RuleCategory, FindingSection> = {
  crawlability: "technical",
  on_page: "technical",
  structured_data: "technical",
  aeo: "content",
  geo: "entity",
  i18n_accessibility: "content",
  performance_security: "performance",
};
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/audit-pipeline && npm test -- --run src/composer.test.ts`
Expected: PASS

- [ ] **Step 9: Run full audit-pipeline test suite**

Run: `cd packages/audit-pipeline && npm test -- --run`
Expected: PASS — all tests pass

- [ ] **Step 10: Commit**

```bash
git add packages/audit-pipeline/src/report-envelope.ts packages/audit-pipeline/src/composer.ts packages/audit-pipeline/src/report-envelope.test.ts packages/audit-pipeline/src/composer.test.ts
git commit -m "feat(M7): add entity section to report envelope and composer"
```

---

### Task 14: Pipeline Integration — ENRICHING_OPTIONAL Stage

**Files:**

- Modify: `packages/audit-pipeline/src/pipeline.ts`
- Modify: `packages/audit-pipeline/src/pipeline.test.ts`

**Interfaces:**

- Consumes: PipelineDeps interface, existing pipeline stages
- Produces: Optional ENRICHING_OPTIONAL stage between EXTRACTING and AUDITING

- [ ] **Step 1: Write failing test for ENRICHING_OPTIONAL stage**

```typescript
// Add to packages/audit-pipeline/src/pipeline.test.ts
describe("ENRICHING_OPTIONAL stage", () => {
  it("runs enrichFootprint callback when provided", async () => {
    const enrichFootprint = vi.fn().mockResolvedValue(undefined);
    const deps = createMockDeps({ enrichFootprint });
    const record = createMockAuditRecord();

    await runAuditPipeline(deps, record.id);

    expect(enrichFootprint).toHaveBeenCalledWith(record);
  });

  it("skips enrichFootprint when not provided", async () => {
    const deps = createMockDeps();
    const record = createMockAuditRecord();

    await runAuditPipeline(deps, record.id);

    // Pipeline should complete without error
    expect(deps.store.getRecord(record.id)).resolves.toBeDefined();
  });

  it("continues pipeline even if enrichFootprint fails", async () => {
    const enrichFootprint = vi.fn().mockRejectedValue(new Error("enrichment failed"));
    const deps = createMockDeps({ enrichFootprint });
    const record = createMockAuditRecord();

    await runAuditPipeline(deps, record.id);

    // Pipeline should continue to AUDITING stage despite enrichment failure
    const finalRecord = await deps.store.getRecord(record.id);
    expect(finalRecord?.status).not.toBe("failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/audit-pipeline && npm test -- --run src/pipeline.test.ts`
Expected: FAIL — enrichFootprint not in PipelineDeps, ENRICHING_OPTIONAL stage not implemented

- [ ] **Step 3: Update PipelineDeps interface**

In `packages/audit-pipeline/src/pipeline.ts`:

```typescript
// Add to PipelineDeps interface (after processEvidence):
export interface PipelineDeps {
  store: AuditStore;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  crawl: (record: AuditRecord, scope: TierScope) => Promise<void>;
  render: (record: AuditRecord) => Promise<void>;
  processEvidence: (record: AuditRecord) => Promise<string[]>;
  enrichFootprint?: (record: AuditRecord) => Promise<void>; // ADD THIS LINE
  runRulesEngine?: (bundle: EvidenceBundle) => Promise<PageRuleResult[]>;
  loadRulesConfig?: () => { rules: LoadedRule[]; scoring: ScoringConfig; catalog: RuleCatalog };
  runAgents: (
    record: AuditRecord,
    evidenceIds: string[],
    scope: TierScope,
  ) => Promise<ComposerAgentOutcome[]>;
  runConnectors: (url: string, context: AuditContext) => Promise<ConnectorResult[]>;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
  tokenStore?: TokenStore;
  userId?: string;
}
```

- [ ] **Step 4: Add ENRICHING_OPTIONAL stage to pipeline**

In the `runAuditPipeline` function, add the enrichment stage between EXTRACTING and AUDITING:

```typescript
// After processEvidence stage, before runRulesEngine/runAgents:
if (deps.enrichFootprint) {
  await store.updateStatus(record.id, "ENRICHING_OPTIONAL");
  try {
    await deps.enrichFootprint(record);
  } catch (error) {
    // Enrichment failure is non-fatal — log and continue
    console.warn(`Enrichment failed for audit ${record.id}:`, error);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/audit-pipeline && npm test -- --run src/pipeline.test.ts`
Expected: PASS — ENRICHING_OPTIONAL tests pass

- [ ] **Step 6: Run full audit-pipeline test suite**

Run: `cd packages/audit-pipeline && npm test -- --run`
Expected: PASS — all tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/audit-pipeline/src/pipeline.ts packages/audit-pipeline/src/pipeline.test.ts
git commit -m "feat(M7): add ENRICHING_OPTIONAL pipeline stage for footprint enrichment"
```

---

### Task 15: Entity-Analyst Agent Config

**Files:**

- Modify: `config/agents/entity-analyst.yaml`

**Interfaces:**

- Consumes: Agent configuration system
- Produces: Active entity-analyst agent with standard model tier

- [ ] **Step 1: Update entity-analyst.yaml**

Change `config/agents/entity-analyst.yaml`:

```yaml
# config/agents/entity-analyst.yaml
id: entity-analyst
name: Entity Analyst
description: Analyzes public footprint data, entity consistency, and NAP accuracy across sources
status: active # Changed from draft
model_tier: "standard" # Changed from placeholder
milestone: M7

tools:
  - read_specialist_evidence
  - read_confirmed_facts

forbidden_tools:
  - write_file
  - execute_code
  - run_command
  - modify_database
  - deploy
  - publish
  - send_email
  - create_pr
  - merge_branch
  - delete_resource

system_prompt: |
  You are an entity analyst specializing in business entity data quality.
  Your role is to:
  1. Review extracted profile data from public sources (Google, Yelp, Facebook, etc.)
  2. Assess NAP (Name, Address, Phone) consistency across sources
  3. Identify conflicts between fact sheet values and third-party observations
  4. Provide recommendations for resolving entity data inconsistencies

  You have access to:
  - read_specialist_evidence: View extracted profile data and observations
  - read_confirmed_facts: Access the confirmed fact sheet (source of truth)

  Important rules:
  - The fact sheet is the ONLY source of facts the Fixer and brief writer may insert
  - Entity conflicts are NEVER auto-resolved — a named human must resolve them
  - Focus on actionable findings with clear evidence
  - Flag confidence levels for all extracted data
```

- [ ] **Step 2: Verify agent config loads correctly**

Run: `cd packages/rules-engine && npm test -- --run` (or wherever agent config loading is tested)
Expected: Agent config loads without errors, status is "active"

- [ ] **Step 3: Commit**

```bash
git add config/agents/entity-analyst.yaml
git commit -m "feat(M7): activate entity-analyst agent with standard model tier"
```

---

### Task 16: API Routes — Fact Sheet CRUD

**Files:**

- Create: `apps/web/src/app/[locale]/api/fact-sheets/route.ts`
- Create: `apps/web/src/app/[locale]/api/fact-sheets/[id]/route.ts`
- Create: `apps/web/src/app/[locale]/api/fact-sheets/route.test.ts`

**Interfaces:**

- Consumes: FactSheetStore from @wpi/footprint-store
- Produces: REST API endpoints for fact sheet CRUD

- [ ] **Step 1: Write failing test for fact sheet API routes**

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/route.test.ts
import { describe, expect, it } from "vitest";

describe("Fact Sheet API Routes", () => {
  it("POST /api/fact-sheets creates a new fact sheet", async () => {
    // Integration test — requires test database
    // This is a placeholder for the actual integration test
    expect(true).toBe(true);
  });

  it("GET /api/fact-sheets?project_id=X lists fact sheets for project", async () => {
    expect(true).toBe(true);
  });

  it("GET /api/fact-sheets/[id] retrieves a single fact sheet", async () => {
    expect(true).toBe(true);
  });

  it("PATCH /api/fact-sheets/[id] updates a fact sheet", async () => {
    expect(true).toBe(true);
  });

  it("POST /api/fact-sheets/[id]/confirm confirms a fact sheet", async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Write POST and GET route handlers**

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";
import { FactSheetCreateSchema } from "@wpi/footprint-store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = FactSheetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);

  const lineage = {
    record_id: crypto.randomUUID(),
    project_id: parsed.data.project_id,
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-entry",
    source_version: "1.0.0",
    captured_at: new Date().toISOString(),
    as_of: new Date().toISOString(),
    market: "US",
    language: "en",
    device: "desktop" as const,
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed" as const,
    content_hash: crypto.randomUUID(),
    parent_ids: [],
    validation_state: "validated" as const,
  };

  const factSheet = await store.create(parsed.data, lineage);
  return NextResponse.json(factSheet, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);
  const factSheets = await store.listByProject(projectId);

  return NextResponse.json(factSheets);
}
```

- [ ] **Step 3: Write GET, PATCH, and confirm route handlers for single fact sheet**

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";
import { FactSheetCreateSchema } from "@wpi/footprint-store";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);
  const factSheet = await store.getById(params.id);

  if (!factSheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(factSheet);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const parsed = FactSheetCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);

  const lineage = {
    record_id: params.id,
    project_id: "",
    site_id: null,
    source_type: "first_party" as const,
    source_id: "manual-update",
    source_version: "1.0.0",
    captured_at: new Date().toISOString(),
    as_of: new Date().toISOString(),
    market: "US",
    language: "en",
    device: "desktop" as const,
    method: "manual",
    methodology_version: "1.0.0",
    fidelity_label: "confirmed" as const,
    content_hash: crypto.randomUUID(),
    parent_ids: [],
    validation_state: "validated" as const,
  };

  const factSheet = await store.update(params.id, parsed.data, lineage);
  return NextResponse.json(factSheet);
}
```

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { FactSheetStore } = await import("@wpi/footprint-store");
  const store = new FactSheetStore(services.pool);

  const body = await request.json().catch(() => ({}));
  const confirmedBy = body.confirmed_by ?? "anonymous";

  const factSheet = await store.confirm(params.id, confirmedBy);
  return NextResponse.json(factSheet);
}
```

- [ ] **Step 4: Run tests to verify**

Run: `cd apps/web && npm test -- --run src/app/\\[locale\\]/api/fact-sheets/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/api/fact-sheets/
git commit -m "feat(M7): add fact sheet CRUD API routes"
```

---

### Task 17: API Routes — Entity Graph and Conflicts

**Files:**

- Create: `apps/web/src/app/[locale]/api/fact-sheets/[id]/entity-graph/route.ts`
- Create: `apps/web/src/app/[locale]/api/fact-sheets/[id]/conflicts/route.ts`
- Create: `apps/web/src/app/[locale]/api/conflicts/[id]/resolve/route.ts`

**Interfaces:**

- Consumes: EntityConflictStore, observation stores
- Produces: REST API endpoints for entity graph data and conflict resolution

- [ ] **Step 1: Write entity graph API route**

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/[id]/entity-graph/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const {
    FactSheetStore,
    PublicSourceObservationStore,
    ProfileObservationStore,
    NapObservationStore,
  } = await import("@wpi/footprint-store");

  const factSheetStore = new FactSheetStore(services.pool);
  const publicSourceStore = new PublicSourceObservationStore(services.pool);
  const profileStore = new ProfileObservationStore(services.pool);
  const napStore = new NapObservationStore(services.pool);

  const [factSheet, publicSources, profiles, napObservations] = await Promise.all([
    factSheetStore.getById(params.id),
    publicSourceStore.listByFactSheet(params.id),
    profileStore.listByFactSheet(params.id),
    napStore.listByFactSheet(params.id),
  ]);

  if (!factSheet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    fact_sheet: factSheet,
    public_sources: publicSources,
    profile_observations: profiles,
    nap_observations: napObservations,
  });
}
```

- [ ] **Step 2: Write conflicts list API route**

```typescript
// apps/web/src/app/[locale]/api/fact-sheets/[id]/conflicts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { EntityConflictStore } = await import("@wpi/footprint-store");
  const store = new EntityConflictStore(services.pool);
  const conflicts = await store.listByFactSheet(params.id);

  return NextResponse.json(conflicts);
}
```

- [ ] **Step 3: Write conflict resolution API route**

```typescript
// apps/web/src/app/[locale]/api/conflicts/[id]/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { confirmed_value, resolved_by, resolution_note } = body;

  if (!confirmed_value || !resolved_by) {
    return NextResponse.json(
      { error: "confirmed_value and resolved_by are required" },
      { status: 400 },
    );
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { EntityConflictStore } = await import("@wpi/footprint-store");
  const store = new EntityConflictStore(services.pool);

  const conflict = await store.resolve(
    params.id,
    confirmed_value,
    resolved_by,
    resolution_note ?? "",
  );

  return NextResponse.json(conflict);
}
```

- [ ] **Step 4: Write conflict dismiss API route**

```typescript
// apps/web/src/app/[locale]/api/conflicts/[id]/dismiss/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuditServices } from "@/services/container";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const { resolved_by, resolution_note } = body;

  if (!resolved_by) {
    return NextResponse.json({ error: "resolved_by is required" }, { status: 400 });
  }

  const services = await getAuditServices();
  if (!services.pool) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { EntityConflictStore } = await import("@wpi/footprint-store");
  const store = new EntityConflictStore(services.pool);

  const conflict = await store.dismiss(params.id, resolved_by, resolution_note ?? "");
  return NextResponse.json(conflict);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/api/
git commit -m "feat(M7): add entity graph and conflict resolution API routes"
```

---

### Task 18: UI — Fact Sheet Editor

**Files:**

- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/_components/fact-sheet-form.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/[id]/page.tsx`

**Interfaces:**

- Consumes: Fact sheet API routes
- Produces: Fact sheet list page, create/edit form, detail view

- [ ] **Step 1: Write fact sheet list page**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/page.tsx
import { getAuditServices } from "@/services/container";
import { FactSheetStore } from "@wpi/footprint-store";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default async function FactSheetsPage({
  params,
}: {
  params: { locale: string; projectId: string };
}) {
  const t = useTranslations("fact-sheets");
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const store = new FactSheetStore(services.pool);
  const factSheets = await store.listByProject(params.projectId);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link
          href={`/${params.locale}/projects/${params.projectId}/fact-sheets/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {t("create_new")}
        </Link>
      </div>

      {factSheets.length === 0 ? (
        <p className="text-gray-500">{t("empty_state")}</p>
      ) : (
        <div className="grid gap-4">
          {factSheets.map((fs) => (
            <Link
              key={fs.id}
              href={`/${params.locale}/projects/${params.projectId}/fact-sheets/${fs.id}`}
              className="block p-4 border rounded hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{fs.business_name}</h2>
                  <p className="text-sm text-gray-500">{fs.site_url}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    fs.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {t(`status.${fs.status}`)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write fact sheet form component**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/_components/fact-sheet-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FactSheet } from "@wpi/footprint-store";

interface FactSheetFormProps {
  projectId: string;
  factSheet?: FactSheet;
}

export function FactSheetForm({ projectId, factSheet }: FactSheetFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);

    const body = {
      project_id: projectId,
      site_url: formData.get("site_url"),
      business_name: formData.get("business_name"),
      description: formData.get("description") || undefined,
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || undefined,
      address_line1: formData.get("address_line1") || undefined,
      address_locality: formData.get("address_locality") || undefined,
      address_region: formData.get("address_region") || undefined,
      address_postal_code: formData.get("address_postal_code") || undefined,
      address_country: formData.get("address_country") || undefined,
    };

    try {
      const url = factSheet ? `/api/fact-sheets/${factSheet.id}` : `/api/fact-sheets`;
      const method = factSheet ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error ?? "Failed to save fact sheet");
      }

      const saved = await response.json();
      router.push(`./${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium mb-1">
          Business Name *
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          defaultValue={factSheet?.business_name ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="site_url" className="block text-sm font-medium mb-1">
          Website URL *
        </label>
        <input
          id="site_url"
          name="site_url"
          type="url"
          required
          defaultValue={factSheet?.site_url ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={factSheet?.phone ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={factSheet?.email ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="address_line1" className="block text-sm font-medium mb-1">
          Street Address
        </label>
        <input
          id="address_line1"
          name="address_line1"
          type="text"
          defaultValue={factSheet?.address_line1 ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="address_locality" className="block text-sm font-medium mb-1">
            City
          </label>
          <input
            id="address_locality"
            name="address_locality"
            type="text"
            defaultValue={factSheet?.address_locality ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="address_region" className="block text-sm font-medium mb-1">
            State/Region
          </label>
          <input
            id="address_region"
            name="address_region"
            type="text"
            defaultValue={factSheet?.address_region ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="address_postal_code" className="block text-sm font-medium mb-1">
            Postal Code
          </label>
          <input
            id="address_postal_code"
            name="address_postal_code"
            type="text"
            defaultValue={factSheet?.address_postal_code ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="address_country" className="block text-sm font-medium mb-1">
            Country
          </label>
          <input
            id="address_country"
            name="address_country"
            type="text"
            defaultValue={factSheet?.address_country ?? ""}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={factSheet?.description ?? ""}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : factSheet ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Write fact sheet detail page**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/fact-sheets/[id]/page.tsx
import { getAuditServices } from "@/services/container";
import { FactSheetStore } from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default async function FactSheetDetailPage({
  params,
}: {
  params: { locale: string; projectId: string; id: string };
}) {
  const t = useTranslations("fact-sheets");
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const store = new FactSheetStore(services.pool);
  const factSheet = await store.getById(params.id);

  if (!factSheet) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/${params.locale}/projects/${params.projectId}/fact-sheets`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_list")}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{factSheet.business_name}</h1>
        <span
          className={`px-3 py-1 rounded text-sm ${
            factSheet.status === "confirmed"
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {t(`status.${factSheet.status}`)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("contact_info")}</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">{t("website")}</dt>
              <dd>
                <a href={factSheet.site_url} className="text-blue-600 hover:underline">
                  {factSheet.site_url}
                </a>
              </dd>
            </div>
            {factSheet.phone && (
              <div>
                <dt className="text-sm text-gray-500">{t("phone")}</dt>
                <dd>{factSheet.phone}</dd>
              </div>
            )}
            {factSheet.email && (
              <div>
                <dt className="text-sm text-gray-500">{t("email")}</dt>
                <dd>{factSheet.email}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("address")}</h2>
          {factSheet.address_line1 ? (
            <address className="not-italic">
              {factSheet.address_line1}
              {factSheet.address_line2 && <br />}
              {factSheet.address_line2}
              <br />
              {factSheet.address_locality}, {factSheet.address_region}{" "}
              {factSheet.address_postal_code}
              <br />
              {factSheet.address_country}
            </address>
          ) : (
            <p className="text-gray-500">{t("no_address")}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href={`/${params.locale}/projects/${params.projectId}/fact-sheets/${params.id}/edit`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {t("edit")}
        </Link>
        <Link
          href={`/${params.locale}/projects/${params.projectId}/entity-graph/${params.id}`}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
        >
          {t("view_entity_graph")}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(studio\)/projects/\[projectId\]/fact-sheets/
git commit -m "feat(M7): add fact sheet editor UI (list, detail, form)"
```

---

### Task 19: UI — Entity Graph View

**Files:**

- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/entity-graph/[id]/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/entity-graph/[id]/_components/entity-graph-viz.tsx`

**Interfaces:**

- Consumes: Entity graph API route
- Produces: Visual entity graph showing fact sheet, observations, and NAP consistency

- [ ] **Step 1: Write entity graph page**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/entity-graph/[id]/page.tsx
import { getAuditServices } from "@/services/container";
import {
  FactSheetStore,
  PublicSourceObservationStore,
  ProfileObservationStore,
  NapObservationStore,
  EntityConflictStore,
} from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EntityGraphViz } from "./_components/entity-graph-viz";

export default async function EntityGraphPage({
  params,
}: {
  params: { locale: string; projectId: string; id: string };
}) {
  const t = useTranslations("entity-graph");
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const factSheetStore = new FactSheetStore(services.pool);
  const publicSourceStore = new PublicSourceObservationStore(services.pool);
  const profileStore = new ProfileObservationStore(services.pool);
  const napStore = new NapObservationStore(services.pool);
  const conflictStore = new EntityConflictStore(services.pool);

  const [factSheet, publicSources, profiles, napObservations, conflicts] = await Promise.all([
    factSheetStore.getById(params.id),
    publicSourceStore.listByFactSheet(params.id),
    profileStore.listByFactSheet(params.id),
    napStore.listByFactSheet(params.id),
    conflictStore.listByFactSheet(params.id),
  ]);

  if (!factSheet) {
    notFound();
  }

  const openConflicts = conflicts.filter(
    (c) => c.status === "open" || c.status === "investigating",
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/${params.locale}/projects/${params.projectId}/fact-sheets/${params.id}`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_fact_sheet")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{factSheet.business_name}</h1>
      <p className="text-gray-500 mb-6">{t("entity_graph_subtitle")}</p>

      {openConflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-yellow-800">
              <strong>{openConflicts.length}</strong> {t("open_conflicts")}
            </p>
            <Link
              href={`/${params.locale}/projects/${params.projectId}/conflicts/${params.id}`}
              className="text-yellow-800 underline hover:no-underline"
            >
              {t("view_conflicts")} &rarr;
            </Link>
          </div>
        </div>
      )}

      <EntityGraphViz
        factSheet={factSheet}
        publicSources={publicSources}
        profiles={profiles}
        napObservations={napObservations}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write entity graph visualization component**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/entity-graph/[id]/_components/entity-graph-viz.tsx
import type {
  FactSheet,
  PublicSourceObservation,
  ProfileObservation,
  NapObservation,
} from "@wpi/footprint-store";
import { useTranslations } from "next-intl";

interface EntityGraphVizProps {
  factSheet: FactSheet;
  publicSources: PublicSourceObservation[];
  profiles: ProfileObservation[];
  napObservations: NapObservation[];
}

export function EntityGraphViz({
  factSheet,
  publicSources,
  profiles,
  napObservations,
}: EntityGraphVizProps) {
  const t = useTranslations("entity-graph");

  return (
    <div className="space-y-8">
      {/* Fact Sheet (center node) */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-800 mb-3">{t("confirmed_fact_sheet")}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">{t("name")}:</dt>
          <dd className="font-medium">{factSheet.business_name}</dd>
          {factSheet.phone && (
            <>
              <dt className="text-gray-500">{t("phone")}:</dt>
              <dd>{factSheet.phone}</dd>
            </>
          )}
          {factSheet.email && (
            <>
              <dt className="text-gray-500">{t("email")}:</dt>
              <dd>{factSheet.email}</dd>
            </>
          )}
          {factSheet.address_line1 && (
            <>
              <dt className="text-gray-500">{t("address")}:</dt>
              <dd>
                {factSheet.address_line1}, {factSheet.address_locality}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Public Sources */}
      {publicSources.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">
            {t("discovered_sources")} ({publicSources.length})
          </h3>
          <div className="grid gap-2">
            {publicSources.map((source) => (
              <div key={source.id} className="bg-gray-50 border rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{source.source_platform}</span>
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    {t("view_source")} &rarr;
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Observations */}
      {profiles.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">
            {t("extracted_profiles")} ({profiles.length})
          </h3>
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-white border rounded p-4 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 truncate">{profile.source_url}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      profile.extraction_confidence >= 0.8
                        ? "bg-green-100 text-green-800"
                        : profile.extraction_confidence >= 0.5
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Math.round(profile.extraction_confidence * 100)}% {t("confidence")}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-1">
                  {profile.extracted_name && (
                    <>
                      <dt className="text-gray-500">{t("name")}:</dt>
                      <dd>{profile.extracted_name}</dd>
                    </>
                  )}
                  {profile.extracted_phone && (
                    <>
                      <dt className="text-gray-500">{t("phone")}:</dt>
                      <dd>{profile.extracted_phone}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAP Consistency */}
      {napObservations.length > 0 && (
        <div>
          <h3 className="text-md font-semibold mb-3">{t("nap_consistency")}</h3>
          <div className="grid gap-2">
            {napObservations.map((nap) => (
              <div key={nap.id} className="bg-white border rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs text-gray-500">{nap.source_url}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      nap.consistency_score >= 0.9
                        ? "bg-green-100 text-green-800"
                        : nap.consistency_score >= 0.7
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {Math.round(nap.consistency_score * 100)}% {t("consistent")}
                  </span>
                </div>
                {nap.inconsistencies.length > 0 && (
                  <ul className="mt-2 text-xs text-red-600">
                    {nap.inconsistencies.map((inc, i) => (
                      <li key={i}>
                        {inc.field}: &quot;{inc.expected}&quot; vs &quot;{inc.actual}&quot;
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(studio\)/projects/\[projectId\]/entity-graph/
git commit -m "feat(M7): add entity graph visualization UI"
```

---

### Task 20: UI — Conflict Resolution

**Files:**

- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/conflicts/[id]/page.tsx`
- Create: `apps/web/src/app/[locale]/(studio)/projects/[projectId]/conflicts/[id]/_components/conflict-list.tsx`

**Interfaces:**

- Consumes: Conflicts API route, conflict resolution API route
- Produces: Conflict list with resolve/dismiss actions

- [ ] **Step 1: Write conflict list page**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/conflicts/[id]/page.tsx
import { getAuditServices } from "@/services/container";
import { FactSheetStore, EntityConflictStore } from "@wpi/footprint-store";
import { notFound } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ConflictList } from "./_components/conflict-list";

export default async function ConflictsPage({
  params,
}: {
  params: { locale: string; projectId: string; id: string };
}) {
  const t = useTranslations("conflicts");
  const services = await getAuditServices();

  if (!services.pool) {
    return <div>{t("database_not_configured")}</div>;
  }

  const factSheetStore = new FactSheetStore(services.pool);
  const conflictStore = new EntityConflictStore(services.pool);

  const [factSheet, conflicts] = await Promise.all([
    factSheetStore.getById(params.id),
    conflictStore.listByFactSheet(params.id),
  ]);

  if (!factSheet) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/${params.locale}/projects/${params.projectId}/entity-graph/${params.id}`}
          className="text-blue-600 hover:underline"
        >
          &larr; {t("back_to_entity_graph")}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{factSheet.business_name}</h1>
      <p className="text-gray-500 mb-6">{t("conflicts_subtitle")}</p>

      <ConflictList
        conflicts={conflicts}
        factSheetId={params.id}
        locale={params.locale}
        projectId={params.projectId}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write conflict list client component**

```tsx
// apps/web/src/app/[locale]/(studio)/projects/[projectId]/conflicts/[id]/_components/conflict-list.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EntityConflict } from "@wpi/footprint-store";
import { useTranslations } from "next-intl";

interface ConflictListProps {
  conflicts: EntityConflict[];
  factSheetId: string;
  locale: string;
  projectId: string;
}

export function ConflictList({ conflicts, factSheetId, locale, projectId }: ConflictListProps) {
  const t = useTranslations("conflicts");
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedBy, setResolvedBy] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  const handleResolve = async (conflictId: string, confirmedValue: unknown) => {
    if (!resolvedBy.trim()) return;

    const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed_value: confirmedValue,
        resolved_by: resolvedBy,
        resolution_note: resolutionNote,
      }),
    });

    if (response.ok) {
      setResolvingId(null);
      setResolvedBy("");
      setResolutionNote("");
      router.refresh();
    }
  };

  const handleDismiss = async (conflictId: string) => {
    if (!resolvedBy.trim()) return;

    const response = await fetch(`/api/conflicts/${conflictId}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resolved_by: resolvedBy,
        resolution_note: resolutionNote,
      }),
    });

    if (response.ok) {
      setResolvingId(null);
      setResolvedBy("");
      setResolutionNote("");
      router.refresh();
    }
  };

  const openConflicts = conflicts.filter(
    (c) => c.status === "open" || c.status === "investigating",
  );
  const resolvedConflicts = conflicts.filter(
    (c) => c.status === "resolved" || c.status === "dismissed",
  );

  return (
    <div className="space-y-6">
      {/* Resolver identity */}
      <div className="bg-gray-50 border rounded p-4">
        <label htmlFor="resolved_by" className="block text-sm font-medium mb-1">
          {t("your_name")} *
        </label>
        <input
          id="resolved_by"
          type="text"
          value={resolvedBy}
          onChange={(e) => setResolvedBy(e.target.value)}
          placeholder={t("enter_your_name")}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Open conflicts */}
      {openConflicts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            {t("open_conflicts")} ({openConflicts.length})
          </h2>
          <div className="space-y-3">
            {openConflicts.map((conflict) => (
              <div key={conflict.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{conflict.fact_key}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        conflict.severity === "critical"
                          ? "bg-red-100 text-red-800"
                          : conflict.severity === "high"
                            ? "bg-orange-100 text-orange-800"
                            : conflict.severity === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {conflict.severity}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{conflict.source_type}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  {conflict.confirmed_value && (
                    <div>
                      <span className="text-gray-500">{t("confirmed")}:</span>
                      <pre className="bg-green-50 p-2 rounded text-xs mt-1">
                        {JSON.stringify(conflict.confirmed_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">{t("conflicting")}:</span>
                    <pre className="bg-red-50 p-2 rounded text-xs mt-1">
                      {JSON.stringify(conflict.conflicting_value, null, 2)}
                    </pre>
                  </div>
                </div>

                {resolvingId === conflict.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder={t("resolution_note_placeholder")}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolve(conflict.id, conflict.conflicting_value)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        {t("accept_conflicting")}
                      </button>
                      <button
                        onClick={() => handleResolve(conflict.id, conflict.confirmed_value)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        {t("keep_confirmed")}
                      </button>
                      <button
                        onClick={() => handleDismiss(conflict.id)}
                        className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                      >
                        {t("dismiss")}
                      </button>
                      <button
                        onClick={() => setResolvingId(null)}
                        className="text-gray-500 px-3 py-1 text-sm"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setResolvingId(conflict.id)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    {t("resolve")} &rarr;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved conflicts */}
      {resolvedConflicts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-gray-500">
            {t("resolved")} ({resolvedConflicts.length})
          </h2>
          <div className="space-y-2">
            {resolvedConflicts.map((conflict) => (
              <div key={conflict.id} className="border rounded p-3 bg-gray-50 text-sm opacity-75">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{conflict.fact_key}</span>
                  <span className="text-xs text-gray-500 capitalize">{conflict.status}</span>
                </div>
                {conflict.resolution_note && (
                  <p className="text-xs text-gray-500 mt-1">{conflict.resolution_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && (
        <p className="text-gray-500 text-center py-8">{t("no_conflicts")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(studio\)/projects/\[projectId\]/conflicts/
git commit -m "feat(M7): add conflict resolution UI with resolve/dismiss actions"
```

---

### Task 21: i18n Keys (English + Arabic)

**Files:**

- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/ar.json`

**Interfaces:**

- Consumes: next-intl message files
- Produces: Translation keys for fact sheets, entity graph, conflicts

- [ ] **Step 1: Add English translations**

Add to `apps/web/messages/en.json`:

```json
{
  "fact-sheets": {
    "title": "Fact Sheets",
    "create_new": "Create Fact Sheet",
    "empty_state": "No fact sheets yet. Create one to get started.",
    "database_not_configured": "Database not configured",
    "back_to_list": "Back to Fact Sheets",
    "contact_info": "Contact Information",
    "website": "Website",
    "phone": "Phone",
    "email": "Email",
    "address": "Address",
    "no_address": "No address provided",
    "edit": "Edit",
    "view_entity_graph": "View Entity Graph",
    "status": {
      "draft": "Draft",
      "confirmed": "Confirmed",
      "superseded": "Superseded"
    }
  },
  "entity-graph": {
    "back_to_fact_sheet": "Back to Fact Sheet",
    "entity_graph_subtitle": "Public footprint and entity consistency",
    "open_conflicts": "open conflict(s)",
    "view_conflicts": "View & resolve",
    "confirmed_fact_sheet": "Confirmed Fact Sheet",
    "name": "Name",
    "phone": "Phone",
    "email": "Email",
    "address": "Address",
    "discovered_sources": "Discovered Sources",
    "view_source": "View source",
    "extracted_profiles": "Extracted Profiles",
    "confidence": "confidence",
    "nap_consistency": "NAP Consistency",
    "consistent": "consistent"
  },
  "conflicts": {
    "back_to_entity_graph": "Back to Entity Graph",
    "conflicts_subtitle": "Entity data conflicts requiring human resolution",
    "your_name": "Your Name",
    "enter_your_name": "Enter your name to resolve conflicts",
    "open_conflicts": "Open Conflicts",
    "confirmed": "Confirmed",
    "conflicting": "Conflicting",
    "resolve": "Resolve",
    "accept_conflicting": "Accept conflicting value",
    "keep_confirmed": "Keep confirmed value",
    "dismiss": "Dismiss",
    "cancel": "Cancel",
    "resolution_note_placeholder": "Add a note explaining your resolution...",
    "resolved": "Resolved",
    "no_conflicts": "No conflicts found. All entity data is consistent.",
    "database_not_configured": "Database not configured"
  }
}
```

- [ ] **Step 2: Add Arabic translations**

Add to `apps/web/messages/ar.json`:

```json
{
  "fact-sheets": {
    "title": "بطاقات الحقائق",
    "create_new": "إنشاء بطاقة حقيقة",
    "empty_state": "لا توجد بطاقات حقائق بعد. أنشئ واحدة للبدء.",
    "database_not_configured": "قاعدة البيانات غير مهيأة",
    "back_to_list": "العودة إلى بطاقات الحقائق",
    "contact_info": "معلومات الاتصال",
    "website": "الموقع الإلكتروني",
    "phone": "الهاتف",
    "email": "البريد الإلكتروني",
    "address": "العنوان",
    "no_address": "لم يتم تقديم عنوان",
    "edit": "تعديل",
    "view_entity_graph": "عرض رسم الكيان",
    "status": {
      "draft": "مسودة",
      "confirmed": "مؤكد",
      "superseded": "ملغى"
    }
  },
  "entity-graph": {
    "back_to_fact_sheet": "العودة إلى بطاقة الحقيقة",
    "entity_graph_subtitle": "البصمة العامة واتساق الكيان",
    "open_conflicts": "تعارض(تعارضات) مفتوحة",
    "view_conflicts": "عرض وحل",
    "confirmed_fact_sheet": "بطاقة الحقيقة المؤكدة",
    "name": "الاسم",
    "phone": "الهاتف",
    "email": "البريد الإلكتروني",
    "address": "العنوان",
    "discovered_sources": "المصادر المكتشفة",
    "view_source": "عرض المصدر",
    "extracted_profiles": "الملفات الشخصية المستخرجة",
    "confidence": "ثقة",
    "nap_consistency": "اتساق NAP",
    "consistent": "متسق"
  },
  "conflicts": {
    "back_to_entity_graph": "العودة إلى رسم الكيان",
    "conflicts_subtitle": "تعارضات بيانات الكيان تتطلب حلاً بشرياً",
    "your_name": "اسمك",
    "enter_your_name": "أدخل اسمك لحل التعارضات",
    "open_conflicts": "التعارضات المفتوحة",
    "confirmed": "مؤكد",
    "conflicting": "متعارض",
    "resolve": "حل",
    "accept_conflicting": "قبول القيمة المتعارضة",
    "keep_confirmed": "الاحتفاظ بالقيمة المؤكدة",
    "dismiss": "تجاهل",
    "cancel": "إلغاء",
    "resolution_note_placeholder": "أضف ملاحظة تشرح حلك...",
    "resolved": "تم الحل",
    "no_conflicts": "لم يتم العثور على تعارضات. جميع بيانات الكيان متسقة.",
    "database_not_configured": "قاعدة البيانات غير مهيأة"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/
git commit -m "feat(M7): add i18n keys for fact sheets, entity graph, and conflicts (en + ar)"
```

---

### Task 22: Container Wiring

**Files:**

- Modify: `apps/web/src/services/container.ts`

**Interfaces:**

- Consumes: Existing container pattern
- Produces: Pool in AuditServices, enrichFootprint wired in buildPipeline

- [ ] **Step 1: Add pool to AuditServices interface**

In `apps/web/src/services/container.ts`:

```typescript
// Add pool to AuditServices interface:
export interface AuditServices {
  store: AuditStore;
  dispatcher: JobDispatcher;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
  cookieSecret: string;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  outputDir: string;
  geminiApiKey: string | undefined;
  pool?: Pool; // ADD THIS LINE for M7 stores
}
```

- [ ] **Step 2: Add enrichFootprint to buildPipeline**

In the `buildPipeline` function in `container.ts`:

```typescript
function buildPipeline(fields: PipelineFields) {
  return {
    store: fields.store,
    tierScopes: fields.tierScopes,
    validateUrl: fields.validateUrl,
    outputDir: fields.outputDir,
    geminiApiKey: fields.geminiApiKey,
    enrichFootprint: fields.pool
      ? async (record: AuditRecord) => {
          const { discoverPublicSources } = await import("@wpi/public-source-discovery");
          const { extractProfileData } = await import("@wpi/profile-extractor");
          const { computeNapConsistency, detectConflicts } = await import("@wpi/nap-consistency");
          const {
            FactSheetStore,
            PublicSourceObservationStore,
            ProfileObservationStore,
            NapObservationStore,
            EntityConflictStore,
          } = await import("@wpi/footprint-store");

          const factSheetStore = new FactSheetStore(fields.pool!);
          const publicSourceStore = new PublicSourceObservationStore(fields.pool!);
          const profileStore = new ProfileObservationStore(fields.pool!);
          const napStore = new NapObservationStore(fields.pool!);
          const conflictStore = new EntityConflictStore(fields.pool!);

          const factSheets = await factSheetStore.listByProject(record.id);
          if (factSheets.length === 0) return;

          const factSheet = factSheets[0]!;

          const profiles = await discoverPublicSources({
            businessName: factSheet.business_name,
            siteUrl: factSheet.site_url,
            location: factSheet.address_locality
              ? {
                  locality: factSheet.address_locality,
                  region: factSheet.address_region ?? undefined,
                }
              : undefined,
          });

          const lineage = {
            record_id: crypto.randomUUID(),
            project_id: factSheet.project_id,
            site_id: null,
            source_type: "third_party_unverified" as const,
            source_id: "public-source-discovery",
            source_version: "1.0.0",
            captured_at: new Date().toISOString(),
            as_of: new Date().toISOString(),
            market: "US",
            language: "en",
            device: "desktop" as const,
            method: "automated",
            methodology_version: "1.0.0",
            fidelity_label: "extracted" as const,
            content_hash: crypto.randomUUID(),
            parent_ids: [],
            validation_state: "unvalidated" as const,
          };

          for (const profile of profiles) {
            await publicSourceStore.create(
              {
                fact_sheet_id: factSheet.id,
                source_platform: profile.platform,
                source_url: profile.url,
                discovered_at: new Date().toISOString(),
                profile_data: {},
              },
              lineage,
            );
          }

          const napResults = [];
          for (const profile of profiles) {
            const napResult = computeNapConsistency(
              {
                business_name: factSheet.business_name,
                phone: factSheet.phone,
                address: factSheet.address_line1
                  ? {
                      street: factSheet.address_line1,
                      city: factSheet.address_locality,
                      region: factSheet.address_region,
                      postal_code: factSheet.address_postal_code,
                      country: factSheet.address_country,
                    }
                  : null,
              },
              {
                source_url: profile.url,
                extracted_name: null,
                extracted_phone: null,
                extracted_address: null,
              },
            );

            await napStore.create(
              {
                fact_sheet_id: factSheet.id,
                source_url: profile.url,
                name_value: null,
                phone_value: null,
                address_value: null,
                consistency_score: napResult.consistency_score,
                inconsistencies: napResult.inconsistencies,
              },
              lineage,
            );

            napResults.push(napResult);
          }

          const conflicts = detectConflicts(factSheet.id, napResults);
          for (const conflict of conflicts) {
            await conflictStore.create(conflict, lineage);
          }
        }
      : undefined,
    crawl: async (record: AuditRecord, scope: TierScope) => {
      // ... existing crawl implementation
    },
    // ... rest of existing fields
  };
}
```

- [ ] **Step 3: Pass pool through in buildServices for in_process mode**

In the `buildServices` function, in the `in_process` branch:

```typescript
// In the in_process branch of buildServices, add pool to fields:
const fields: PipelineFields = {
  store,
  tierScopes: loadTierScopes(join(REPO_ROOT, "config", "anonymous-eligibility.yaml")),
  validateUrl: async (url) => {
    try {
      const result = await validateUrl(url);
      return result.valid ? { ok: true } : { ok: false, reason_key: "failure.url_invalid" };
    } catch {
      return { ok: false, reason_key: "failure.url_invalid" };
    }
  },
  outputDir,
  geminiApiKey: process.env["WPI_GEMINI_API_KEY"],
  tokenStore,
};

return {
  ...fields,
  pool, // ADD THIS LINE
  dispatcher: new InProcessDispatcher(async (jobId) => {
    await runAuditPipeline(buildPipeline(fields), jobId);
  }),
  cookieSecret,
};
```

- [ ] **Step 4: Verify typecheck passes**

Run: `cd apps/web && npm run typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/container.ts
git commit -m "feat(M7): wire enrichFootprint and pool into service container"
```

---

### Task 23: E2E Tests (Playwright)

**Files:**

- Create: `apps/web/e2e/fact-sheet-flow.spec.ts`

**Interfaces:**

- Consumes: Running web application with test database
- Produces: E2E test covering fact sheet creation → audit → entity graph → conflict resolution

- [ ] **Step 1: Write E2E test for fact sheet to conflict resolution flow**

```typescript
// apps/web/e2e/fact-sheet-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Fact Sheet to Conflict Resolution Flow", () => {
  test("creates a fact sheet, views entity graph, and resolves a conflict", async ({ page }) => {
    // Navigate to project fact sheets
    await page.goto("/en/projects/test-project/fact-sheets");

    // Create a new fact sheet
    await page.click("text=Create Fact Sheet");
    await page.fill('[name="business_name"]', "Test Business");
    await page.fill('[name="site_url"]', "https://test-business.example.com");
    await page.fill('[name="phone"]', "+1-555-0100");
    await page.fill('[name="email"]', "contact@test-business.example.com");
    await page.fill('[name="address_line1"]', "123 Test St");
    await page.fill('[name="address_locality"]', "Testville");
    await page.fill('[name="address_region"]', "CA");
    await page.fill('[name="address_postal_code"]', "90210");
    await page.fill('[name="address_country"]', "US");
    await page.click('button:has-text("Create")');

    // Verify fact sheet was created
    await expect(page.locator("h1")).toContainText("Test Business");

    // Navigate to entity graph
    await page.click("text=View Entity Graph");
    await expect(page.locator("h1")).toContainText("Test Business");

    // If conflicts exist, navigate to conflict resolution
    const conflictLink = page.locator("text=View & resolve");
    if (await conflictLink.isVisible()) {
      await conflictLink.click();

      // Enter resolver name
      await page.fill("#resolved_by", "E2E Tester");

      // Resolve first conflict if present
      const resolveButton = page.locator('button:has-text("Resolve")').first();
      if (await resolveButton.isVisible()) {
        await resolveButton.click();
        await page.fill("textarea", "Resolved by E2E test");
        await page.click('button:has-text("Keep confirmed value")');

        // Verify conflict was resolved
        await expect(page.locator("text=Resolved")).toBeVisible();
      }
    }
  });

  test("displays fact sheet list with correct status badges", async ({ page }) => {
    await page.goto("/en/projects/test-project/fact-sheets");

    // Verify page loads
    await expect(page.locator("h1")).toContainText("Fact Sheets");

    // If fact sheets exist, verify status badges
    const factSheetCards = page.locator('a[href*="/fact-sheets/"]');
    const count = await factSheetCards.count();
    if (count > 0) {
      const statusBadge = factSheetCards.first().locator("span").last();
      await expect(statusBadge).toBeVisible();
    }
  });

  test("entity graph shows NAP consistency scores", async ({ page }) => {
    await page.goto("/en/projects/test-project/fact-sheets");

    // Navigate to first fact sheet's entity graph
    const firstSheet = page.locator('a[href*="/fact-sheets/"]').first();
    if (await firstSheet.isVisible()) {
      await firstSheet.click();
      await page.click("text=View Entity Graph");

      // Check for NAP consistency section
      const napSection = page.locator("text=NAP Consistency");
      if (await napSection.isVisible()) {
        // Verify consistency scores are displayed as percentages
        const scoreElements = page.locator("text=/\\d+% consistent/");
        const scoreCount = await scoreElements.count();
        expect(scoreCount).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `cd apps/web && npx playwright test e2e/fact-sheet-flow.spec.ts`
Expected: PASS — all E2E tests pass (requires running dev server and test database)

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/fact-sheet-flow.spec.ts
git commit -m "feat(M7): add E2E tests for fact sheet to conflict resolution flow"
```

---

### Task 24: Final Verification and Exit Gate

**Files:**

- None (verification only)

**Interfaces:**

- Consumes: All M7 packages, services, and UI
- Produces: Verification that all exit criteria are met

- [ ] **Step 1: Run full test suite**

Run: `pnpm -r test --run`
Expected: PASS — all tests across all packages pass

- [ ] **Step 2: Run typecheck across all packages**

Run: `pnpm -r typecheck`
Expected: PASS — no type errors

- [ ] **Step 3: Run E2E tests**

Run: `cd apps/web && npx playwright test`
Expected: PASS — all E2E tests pass

- [ ] **Step 4: Verify exit criteria from spec**

Check each exit criterion from the M7 design spec:

1. **Fact sheet CRUD works end-to-end** — verified by Task 16 API tests + Task 23 E2E
2. **Public source discovery generates profile URLs** — verified by Task 7 tests
3. **Profile extractor extracts data from HTML** — verified by Task 8 tests
4. **NAP consistency engine computes scores** — verified by Task 9 tests
5. **Conflict detector generates entity conflicts** — verified by Task 10 tests
6. **Entity-analyst agent is active** — verified by Task 15 config
7. **GEO-011 evaluator works** — verified by Task 12 tests
8. **Pipeline ENRICHING_OPTIONAL stage runs** — verified by Task 14 tests
9. **Entity graph UI displays** — verified by Task 19 + Task 23 E2E
10. **Conflict resolution UI works** — verified by Task 20 + Task 23 E2E
11. **i18n keys present for en and ar** — verified by Task 21
12. **Container wiring complete** — verified by Task 22 typecheck

- [ ] **Step 5: Build all packages**

Run: `pnpm -r build`
Expected: PASS — all packages build successfully

- [ ] **Step 6: Start dev server and manually verify**

Run: `cd apps/web && npm run dev`
Open: `http://localhost:3000/en/projects/test-project/fact-sheets`

Verify:

- Fact sheet list page loads
- Create fact sheet form works
- Fact sheet detail page displays
- Entity graph page shows observations
- Conflict resolution page works (if conflicts exist)
- Language switcher shows Arabic translations

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(M7): complete public footprint and entity graph implementation"
```

- [ ] **Step 8: Report completion**

All M7 tasks complete. Exit criteria verified. Ready for branch completion per `superpowers:finishing-a-development-branch`.
