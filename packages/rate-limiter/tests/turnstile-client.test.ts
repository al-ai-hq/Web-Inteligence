import { describe, expect, it, vi, afterEach } from "vitest";
import { verifyTurnstileToken } from "../src/turnstile-client.js";

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    delete process.env["TURNSTILE_SECRET_KEY"];
    vi.restoreAllMocks();
  });

  it("returns true when Cloudflare reports success", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const ok = await verifyTurnstileToken("token", "1.2.3.4");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: "secret", response: "token", remoteip: "1.2.3.4" }),
      }),
    );
  });

  it("returns false when Cloudflare reports failure", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const ok = await verifyTurnstileToken("token");
    expect(ok).toBe(false);
  });

  it("returns false when the request throws", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "secret";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    const ok = await verifyTurnstileToken("token");
    expect(ok).toBe(false);
  });

  it("returns false when TURNSTILE_SECRET_KEY is missing", async () => {
    delete process.env["TURNSTILE_SECRET_KEY"];
    const ok = await verifyTurnstileToken("token");
    expect(ok).toBe(false);
  });
});
