import { describe, it, expect } from "vitest";
import { runAuditPipeline, InMemoryAuditStore } from "../src/index.js";
import { TIER_SCOPES } from "../src/eligibility.js";

async function seedAudit(store: InMemoryAuditStore): Promise<string> {
  const record = await store.create({
    targetUrl: "https://example.com",
    locale: "en",
    tier: "preview",
    context: {
      organization: "Test",
      business_type: "test",
      offering: "test",
      market: "test",
      customer_language: "English",
      audience: "test",
    },
    secretHash: "sha256:" + "a".repeat(64),
    ttlDays: 7,
  });
  return record.id;
}

describe("pipeline with connectors", () => {
  it("runs connectors in parallel with agents", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);

    const outcome = await runAuditPipeline(
      {
        store,
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async () => [
          {
            ok: true,
            connector: "psi",
            data: {
              psi: {
                core_web_vitals: { lcp: 2500, fid: 100, cls: 0.1 },
                opportunities: [],
              },
            },
          },
          {
            ok: true,
            connector: "crux",
            data: {
              crux: {
                metrics: {
                  lcp: { good: 75, needs_improvement: 20, poor: 5 },
                  fid: { good: 90, needs_improvement: 8, poor: 2 },
                  cls: { good: 80, needs_improvement: 15, poor: 5 },
                },
                origin: "https://example.com",
                effective_connection_type: "4G",
              },
            },
          },
        ],
        tierScopes: TIER_SCOPES,
      },
      auditId,
    );

    expect(outcome).toBe("partial");
    const record = await store.getRaw(auditId);
    expect(record?.status).toBe("READY_PARTIAL");
  });

  it("continues when connectors fail", async () => {
    const store = new InMemoryAuditStore();
    const auditId = await seedAudit(store);

    const outcome = await runAuditPipeline(
      {
        store,
        validateUrl: async () => ({ ok: true }),
        crawl: async () => {},
        render: async () => {},
        processEvidence: async () => [],
        runAgents: async () => [],
        runConnectors: async () => [
          {
            ok: false,
            connector: "psi",
            unavailable_reason_key: "unavailable.connector.psi",
          },
        ],
        tierScopes: TIER_SCOPES,
      },
      auditId,
    );

    expect(outcome).toBe("partial");
    const record = await store.getRaw(auditId);
    expect(record?.status).toBe("READY_PARTIAL");
    expect(record?.report?.unavailable).toContainEqual(
      expect.objectContaining({
        reason_key: "unavailable.connector.psi",
      }),
    );
  });
});
