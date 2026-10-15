import { afterEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "@wpi/audit-pipeline";
import { getAuditServices, setAuditServicesForTests } from "../services/container";

const ENV_KEYS = [
  "WPI_DISPATCH_MODE",
  "COOKIE_SECRET",
  "DATABASE_URL",
  "WPI_DATABASE_URL",
  "AUDIT_COOKIE_SECRET",
] as const;

afterEach(() => {
  setAuditServicesForTests(null);
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("getAuditServices", () => {
  it("builds stub-mode services by default", async () => {
    const services = await getAuditServices();
    expect(services.store).toBeInstanceOf(InMemoryAuditStore);
    expect(services.geminiApiKey).toBeUndefined();
    expect((await services.validateUrl("https://example.com")).ok).toBe(true);
    expect((await services.validateUrl("not-a-url")).ok).toBe(false);
  });

  it("caches the same instance across calls", async () => {
    const first = await getAuditServices();
    const second = await getAuditServices();
    expect(second).toBe(first);
  });

  it("rejects in_process mode without required env", async () => {
    process.env["WPI_DISPATCH_MODE"] = "in_process";
    await expect(getAuditServices()).rejects.toThrow(/DATABASE_URL/);
  });
});
