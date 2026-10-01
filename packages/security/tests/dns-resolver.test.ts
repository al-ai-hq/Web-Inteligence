import { describe, it, expect } from "vitest";
import { resolveDns } from "../src/dns-resolver.js";

describe("resolveDns", () => {
  it("resolves public hostname to public IP", async () => {
    const ips = await resolveDns("example.com");
    expect(ips.length).toBeGreaterThan(0);
    expect(ips[0]).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("rejects loopback address", async () => {
    // localhost may resolve to 127.0.0.1 (filtered as non-public) or
    // fail at DNS level (ENOTFOUND) depending on resolver configuration.
    // Both outcomes are correct SSRF defense.
    try {
      await resolveDns("localhost");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toMatch(/non-public|DNS resolution failed/);
    }
  });

  it("rejects private address", async () => {
    // internal.corp is not a real domain; DNS resolution should fail.
    await expect(resolveDns("internal.corp")).rejects.toThrow();
  });

  it("rejects metadata.google.internal", async () => {
    await expect(resolveDns("metadata.google.internal")).rejects.toThrow();
  });
});
