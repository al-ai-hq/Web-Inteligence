import { describe, expect, it, afterEach } from "vitest";
import {
  InMemoryAuditStore,
  TIER_SCOPES,
  runAuditPipeline,
  type PipelineDeps,
  type AuditRecord,
} from "@wpi/audit-pipeline";
import { InMemoryAuthService } from "@wpi/auth";
import { InMemoryRateLimiter } from "@wpi/rate-limiter";
import { StubEmailService, auditCompletionTemplate } from "@wpi/email";
import type { AuditContext } from "@wpi/audit-pipeline";

import { setAuditServicesForTests, type AuditServices } from "../services/container";

const CONTEXT: AuditContext = {
  organization: "Example Corp",
  business_type: "e-commerce",
  offering: "Office furniture",
  market: "Saudi Arabia",
  customer_language: "Arabic",
  audience: "Procurement managers",
};

function makeServices(): AuditServices {
  return {
    store: new InMemoryAuditStore(),
    dispatcher: { dispatch: async () => undefined },
    tierScopes: TIER_SCOPES,
    cookieSecret: "test-cookie-secret",
    auth: new InMemoryAuthService(),
    rateLimiter: new InMemoryRateLimiter(),
    validateUrl: async (url: string) =>
      url.startsWith("https://") || url.startsWith("http://")
        ? { ok: true }
        : { ok: false, reason_key: "failure.url_invalid" },
    outputDir: "./output",
    geminiApiKey: undefined,
    emailService: new StubEmailService(),
  };
}

function makePipelineDeps(services: AuditServices): PipelineDeps {
  return {
    store: services.store,
    validateUrl: services.validateUrl,
    crawl: async () => undefined,
    render: async () => undefined,
    processEvidence: async () => ["ev-1"],
    runAgents: async () => [
      {
        agent_name: "auditor",
        ok: true,
        findings: [
          {
            finding_id: "f-1",
            result_state: "verified",
            confidence: "high",
            evidence_ids: ["ev-1"],
            data: {
              title: "Missing meta description",
              recommendation: "Add one",
              severity: "high",
            },
            limitations: [],
          },
        ],
        limitations: [],
        cost: { engine: "stub", tokens_in: 1, tokens_out: 1, usd: 0.001 },
      },
      { agent_name: "keyword-analyst", ok: true, findings: [], limitations: [] },
      { agent_name: "content-strategist", ok: true, findings: [], limitations: [] },
    ],
    runConnectors: async () => [],
    tierScopes: services.tierScopes,
  };
}

afterEach(() => {
  setAuditServicesForTests(null);
});

describe("audit completion email", () => {
  it("sends an email to the owning user when the audit completes", async () => {
    const services = makeServices();
    setAuditServicesForTests(services);
    const user = await services.auth.createUser("owner@example.com", "password123");
    const record = await services.store.create({
      targetUrl: "https://example.com",
      locale: "en",
      context: CONTEXT,
      tier: "rich",
      secretHash: "sha256:" + "a".repeat(64),
      ttlDays: 7,
      userId: user.id,
    });

    await runAuditPipeline(
      {
        ...makePipelineDeps(services),
        onComplete: async (completed: AuditRecord) => {
          if (!completed.user_id) return;
          const owner = await services.auth.findUserById(completed.user_id);
          if (!owner) return;
          const { subject, html, text } = auditCompletionTemplate({
            locale: completed.locale,
            siteUrl: completed.target_url,
            score: completed.report?.score?.presence_readiness ?? 0,
            reportUrl: `http://localhost:3000/${completed.locale}/audit/${completed.id}`,
          });
          void services.emailService
            .send({ to: owner.email, subject, html, text, locale: completed.locale })
            .catch(() => undefined);
        },
      },
      record.id,
    );

    const sent = (services.emailService as StubEmailService).getSent();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("owner@example.com");
    expect(sent[0]!.subject).toBe("Your WPI audit for example.com is ready");
    expect(sent[0]!.html).toContain(`/en/audit/${record.id}`);
  });
});
