import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { CostTracker } from "@wpi/agents";
import {
  InMemoryAuditStore,
  InProcessDispatcher,
  M4_AGENT_NAMES,
  MIGRATIONS_DIR,
  PostgresAuditStore,
  REPO_ROOT,
  runAgentStage,
  runAuditPipeline,
  StubDispatcher,
  TIER_SCOPES,
  scopedEnv,
  loadTierScopes,
  applyMigrations,
  type AuditRecord,
  type AuditStore,
  type ComposerAgentOutcome,
  type JobDispatcher,
  type TierName,
  type TierScope,
} from "@wpi/audit-pipeline";
import { runConnectors as runAllConnectors, type AuditContext } from "@wpi/connectors";
import { runCrawlJob } from "@wpi/crawler";
import { runEvidenceProcessor } from "@wpi/evidence-processor";
import { runRenderJob } from "@wpi/render-job";
import { validateUrl } from "@wpi/security";
import { TokenStore } from "@wpi/oauth";
import { InMemoryAuthService, PgAuthService, RateLimiter } from "@wpi/auth";
import type { AuthService } from "@wpi/auth";
import { Pool } from "pg";

export interface AuditServices {
  store: AuditStore;
  dispatcher: JobDispatcher;
  tierScopes: Record<Exclude<TierName, "refused">, TierScope>;
  cookieSecret: string;
  auth: AuthService;
  rateLimiter: RateLimiter;
  validateUrl: (url: string) => Promise<{ ok: boolean; reason_key?: string }>;
  outputDir: string;
  geminiApiKey: string | undefined;
  pool?: Pool;
}

// Next.js dev re-evaluates module state when a route compiles for the first
// time, which would otherwise duplicate this singleton (and its in-memory
// store) across route bundles. Cache on globalThis — the pattern Next.js
// recommends for dev-time singletons — so every bundle shares one container.
const globalForAuditServices = globalThis as unknown as {
  __wpiAuditServices?: AuditServices | null;
};

let services: AuditServices | null = null;

export function setAuditServicesForTests(value: AuditServices | null): void {
  services = value;
  globalForAuditServices.__wpiAuditServices = value;
}

export async function getAuditServices(): Promise<AuditServices> {
  if (services !== null) {
    return services;
  }
  const cached = globalForAuditServices.__wpiAuditServices;
  if (cached != null) {
    services = cached;
    return cached;
  }
  services = await buildServices();
  globalForAuditServices.__wpiAuditServices = services;
  return services;
}

type PipelineFields = Pick<
  AuditServices,
  "store" | "tierScopes" | "validateUrl" | "outputDir" | "geminiApiKey" | "pool"
> & {
  tokenStore?: TokenStore;
};

function buildPipeline(fields: PipelineFields) {
  return {
    store: fields.store,
    tierScopes: fields.tierScopes,
    validateUrl: fields.validateUrl,
    outputDir: fields.outputDir,
    geminiApiKey: fields.geminiApiKey,
    enrichFootprint: fields.pool
      ? async (record: AuditRecord, projectId?: string) => {
          if (!projectId) return;
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

          const factSheets = await factSheetStore.listByProject(projectId);
          if (factSheets.length === 0) return;

          const factSheet = factSheets[0]!;

          const profiles = await discoverPublicSources({
            businessName: factSheet.business_name,
            siteUrl: factSheet.site_url,
            location: factSheet.address_locality
              ? { locality: factSheet.address_locality, region: factSheet.address_region ?? undefined }
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
            await publicSourceStore.create({
              fact_sheet_id: factSheet.id,
              source_platform: profile.platform,
              source_url: profile.url,
              discovered_at: new Date().toISOString(),
              profile_data: {},
            }, lineage);
          }

          const napResults = [];
          for (const profile of profiles) {
            const extracted = extractProfileData("", profile.url);
            const cleanAddress = extracted.extracted_address
              ? Object.fromEntries(
                  Object.entries(extracted.extracted_address).filter(([, v]) => v !== null),
                ) as Record<string, string>
              : null;
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
                extracted_name: extracted.extracted_name,
                extracted_phone: extracted.extracted_phone,
                extracted_address: cleanAddress,
              },
            );

            await napStore.create({
              fact_sheet_id: factSheet.id,
              source_url: profile.url,
              name_value: extracted.extracted_name,
              phone_value: extracted.extracted_phone,
              address_value: cleanAddress,
              consistency_score: napResult.consistency_score,
              inconsistencies: napResult.inconsistencies,
            }, lineage);

            napResults.push(napResult);
          }

          const conflicts = detectConflicts(factSheet.id, napResults);
          for (const conflict of conflicts) {
            await conflictStore.create(conflict, lineage);
          }
        }
      : undefined,
    // PipelineDeps declares crawl/render as Promise<void>; the job runners
    // resolve to result objects, which the pipeline contract discards.
    crawl: async (record: AuditRecord, scope: TierScope) => {
      await scopedEnv(
        {
          AUDIT_ID: record.id,
          ROOT_URL: record.target_url,
          SITEMAP_URL: `${new URL(record.target_url).origin}/sitemap.xml`,
          SAMPLING_MODE: scope.maxPages <= 1 ? "single_page" : "representative_sample",
          MAX_PAGES: String(scope.maxPages),
          OUTPUT_DIR: fields.outputDir,
        },
        () => runCrawlJob(),
      );
    },
    render: async (record: AuditRecord) => {
      await scopedEnv(
        { AUDIT_ID: record.id, OUTPUT_DIR: fields.outputDir },
        () => runRenderJob(),
      );
    },
    processEvidence: async (record: AuditRecord): Promise<string[]> => {
      await scopedEnv(
        { AUDIT_ID: record.id, OUTPUT_DIR: fields.outputDir },
        () => runEvidenceProcessor(),
      );
      const files = await readdir(join(fields.outputDir, record.id, "evidence"));
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(/\.json$/, ""));
    },
    runAgents: async (
      record: AuditRecord,
      evidenceIds: string[],
      _scope: TierScope,
    ): Promise<ComposerAgentOutcome[]> => {
      if (fields.geminiApiKey === undefined) {
        return M4_AGENT_NAMES.map((agentName) => ({
          agent_name: agentName,
          ok: false,
          findings: [],
          limitations: [],
          unavailable_reason_key: `unavailable.agent.${agentName}`,
        }));
      }
      return runAgentStage({
        auditId: record.id,
        projectId: record.id,
        targetUrl: record.target_url,
        context: record.context,
        evidenceIds,
        outputDir: fields.outputDir,
        geminiApiKey: fields.geminiApiKey,
        costTracker: new CostTracker(),
      });
    },
    runConnectors: async (url: string, context: AuditContext) => {
      return runAllConnectors(url, context);
    },
    tokenStore: fields.tokenStore,
    userId: fields.tokenStore ? "placeholder" : undefined, // Stubbed until user auth is implemented
  };
}

function localValidateUrl(
  url: string,
): { ok: boolean; reason_key?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { ok: true };
    }
    return { ok: false, reason_key: "failure.url_invalid" };
  } catch {
    return { ok: false, reason_key: "failure.url_invalid" };
  }
}

async function buildServices(): Promise<AuditServices> {
  // Stub is the safe default: buildServices must not require Postgres/cookie
  // env until real dispatch is explicitly requested (matches the brief's
  // tests, which build stub-mode services with no env set).
  const dispatchMode = process.env["WPI_DISPATCH_MODE"] ?? "stub";

  if (process.env["NODE_ENV"] === "production" && dispatchMode === "stub") {
    throw new Error(
      "Refusing to start with WPI_DISPATCH_MODE=stub in production. Set WPI_DISPATCH_MODE=in_process.",
    );
  }

  const outputDir = process.env["WPI_OUTPUT_DIR"] ?? "./output";

  if (dispatchMode === "stub") {
    const store = new InMemoryAuditStore();
    const fields: PipelineFields = {
      store,
      tierScopes: TIER_SCOPES,
      validateUrl: async (url) => localValidateUrl(url),
      outputDir,
      geminiApiKey: undefined,
    };
    return {
      ...fields,
      dispatcher: new StubDispatcher(store),
      cookieSecret: process.env["AUDIT_COOKIE_SECRET"] ?? "stub-cookie-secret",
      auth: new InMemoryAuthService(),
      rateLimiter: new RateLimiter(),
    };
  }

  const databaseUrl = process.env["WPI_DATABASE_URL"];
  const cookieSecret = process.env["AUDIT_COOKIE_SECRET"];
  if (databaseUrl === undefined || cookieSecret === undefined) {
    throw new Error(
      "WPI_DATABASE_URL and AUDIT_COOKIE_SECRET are required when WPI_DISPATCH_MODE is not 'stub'",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  await applyMigrations(pool, MIGRATIONS_DIR);
  const store = new PostgresAuditStore(pool);
  await store.sweepExpired();
  const tokenStore = new TokenStore(pool);

  const fields: PipelineFields = {
    store,
    tierScopes: loadTierScopes(join(REPO_ROOT, "config", "anonymous-eligibility.yaml")),
    validateUrl: async (url) => {
      try {
        const result = await validateUrl(url);
        return result.valid
          ? { ok: true }
          : { ok: false, reason_key: "failure.url_invalid" };
      } catch {
        return { ok: false, reason_key: "failure.url_invalid" };
      }
    },
    outputDir,
    geminiApiKey: process.env["WPI_GEMINI_API_KEY"],
    tokenStore,
    pool,
  };

  return {
    ...fields,
    // InProcessDispatcher expects (jobId) => Promise<void>; runAuditPipeline
    // resolves to PipelineOutcome, which the dispatcher contract discards.
    dispatcher: new InProcessDispatcher(async (jobId) => {
      await runAuditPipeline(buildPipeline(fields), jobId);
    }),
    cookieSecret,
    auth: new PgAuthService(pool),
    rateLimiter: new RateLimiter(),
  };
}
