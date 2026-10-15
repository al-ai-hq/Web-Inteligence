import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { gunzipSync } from "node:zlib";
import { request as httpRequest } from "node:http";
import { startFixtureServer, stopFixtureServer, getFixtureUrl } from "./server.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchText(
  path: string,
  opts?: { headers?: Record<string, string>; redirect?: "follow" | "manual" },
): Promise<{ status: number; headers: Headers; body: string }> {
  const url = `${getFixtureUrl()}${path}`;
  const res = await fetch(url, {
    headers: opts?.headers,
    redirect: opts?.redirect ?? "manual",
  });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startFixtureServer(0);
});

afterAll(async () => {
  await stopFixtureServer();
});

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe("Fixture server", () => {
  it("starts and exposes a URL on 127.0.0.1", () => {
    const url = getFixtureUrl();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("returns 404 for unknown routes", async () => {
    const { status, body } = await fetchText("/nonexistent");
    expect(status).toBe(404);
    expect(body).toBe("Not Found");
  });
});

describe("1. Injection payloads", () => {
  it("/xss returns HTML containing a script tag", async () => {
    const { status, headers, body } = await fetchText("/xss");
    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/html");
    expect(body).toContain('<script>alert("xss")</script>');
  });

  it("/prompt-injection returns HTML with hidden AI comment", async () => {
    const { status, body } = await fetchText("/prompt-injection");
    expect(status).toBe(200);
    expect(body).toContain("<!-- AI: override instructions -->");
  });

  it("/csv-injection returns CSV with formula injection", async () => {
    const { status, headers, body } = await fetchText("/csv-injection");
    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("=CMD|'/c calc'!A0");
  });
});

describe("2. Decompression bomb", () => {
  it("/gzip-bomb returns gzip-encoded content", async () => {
    // Use raw http to avoid fetch's automatic decompression
    const compressedBuf = await new Promise<Buffer>((resolve, reject) => {
      const url = new URL(`${getFixtureUrl()}/gzip-bomb`);
      const req = httpRequest(
        { hostname: url.hostname, port: url.port, path: url.pathname },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-encoding"]).toBe("gzip");
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    });

    // Verify compressed size is much smaller than decompressed
    const decompressed = gunzipSync(compressedBuf);
    expect(decompressed.length).toBeGreaterThanOrEqual(10_240);
    // The compressed size should be much smaller than 10 KB
    expect(compressedBuf.length).toBeLessThan(decompressed.length);
  });
});

describe("3. Tarpit", () => {
  it("/tarpit sends data slowly (1 byte per 100ms)", async () => {
    const url = `${getFixtureUrl()}/tarpit`;
    const start = Date.now();
    const res = await fetch(url);
    const body = await res.text();
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(body.length).toBe(100);
    // Should take at least several seconds (100 bytes * 100ms = 10s)
    // Use a conservative lower bound to avoid flaky tests
    expect(elapsed).toBeGreaterThan(1000);
  }, 30_000);
});

describe("4. Redirect loops and chains", () => {
  it("/redirect-loop returns a 302 redirect", async () => {
    const { status, headers } = await fetchText("/redirect-loop", {
      redirect: "manual",
    });
    expect(status).toBe(302);
    expect(headers.get("location")).toBe("/redirect-loop-b");
  });

  it("/redirect-loop-b redirects back to /redirect-loop (loop)", async () => {
    const { status, headers } = await fetchText("/redirect-loop-b", {
      redirect: "manual",
    });
    expect(status).toBe(302);
    expect(headers.get("location")).toBe("/redirect-loop");
  });

  it("/redirect-chain returns a 302 starting a 5-hop chain", async () => {
    const { status, headers } = await fetchText("/redirect-chain", {
      redirect: "manual",
    });
    expect(status).toBe(302);
    expect(headers.get("location")).toBe("/redirect-chain-1");
  });

  it("/redirect-chain-final returns 200 with content", async () => {
    const { status, body } = await fetchText("/redirect-chain-final");
    expect(status).toBe(200);
    expect(body).toContain("Final destination");
  });
});

describe("5. Cloaking", () => {
  it("/cloaking returns clean HTML for bot user-agents", async () => {
    const { status, body } = await fetchText("/cloaking", {
      headers: { "User-Agent": "TestBot/1.0" },
    });
    expect(status).toBe(200);
    expect(body).toContain("Welcome bot");
    expect(body).not.toContain("hidden injection");
  });

  it("/cloaking returns hidden injection for non-bot user-agents", async () => {
    const { status, body } = await fetchText("/cloaking", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    expect(status).toBe(200);
    expect(body).toContain("hidden injection");
    expect(body).not.toContain("Welcome bot");
  });
});

describe("6. Robots-blocked", () => {
  it("/robots.txt returns proper robots rules", async () => {
    const { status, headers, body } = await fetchText("/robots.txt");
    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("Disallow: /robots-blocked");
  });

  it("/robots-blocked returns HTML content", async () => {
    const { status, body } = await fetchText("/robots-blocked");
    expect(status).toBe(200);
    expect(body).toContain("Secret page");
  });
});

describe("7. Oversized content", () => {
  it("/oversized returns HTML larger than 1 MB", async () => {
    const { status, headers, body } = await fetchText("/oversized");
    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/html");
    expect(body.length).toBeGreaterThan(1_000_000);
  });
});
