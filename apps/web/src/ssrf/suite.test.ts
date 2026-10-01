import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { discloseSample, acceptsDisclosure } from "./sample.ts";
import {
  checkFetch,
  checkLimits,
  checkLinkedUrl,
  type Ceilings,
  type Connector,
  type Resolver,
} from "./validate.ts";

const root = path.resolve(import.meta.dirname, "../../../..");
const ceilings = JSON.parse(
  readFileSync(path.join(root, "evals/m1/ceilings.json"), "utf8"),
) as Ceilings;
const denylist = JSON.parse(
  readFileSync(path.join(root, "evals/m1/forbidden-references.json"), "utf8"),
) as { clients: string[]; write_class_tools: string[] };

const atCeiling = {
  response_bytes: ceilings.response_bytes,
  decompressed_bytes: ceilings.decompressed_bytes,
  pages: ceilings.pages,
  depth: ceilings.depth,
  duration_ms: ceilings.duration_ms,
};

function publicResolver(host: string): Resolver {
  return (name) => {
    if (name !== host) {
      throw new Error(`unexpected lookup ${name}`);
    }
    return ["1.2.3.4"];
  };
}

function harness(): { connect: Connector; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    connect(pinned: string) {
      calls.push(pinned);
    },
  };
}

function refused(
  url: string,
  resolve: Resolver = () => {
    throw new Error("resolver must not run");
  },
) {
  const { connect, calls } = harness();
  const decision = checkFetch({
    url,
    ceilings,
    resolve,
    connect,
    observed: atCeiling,
  });
  expect(decision).toEqual({ decision: "refused", reason: expect.any(String) });
  expect(calls).toEqual([]);
  return decision;
}

describe("local SSRF suite", () => {
  it("rejects schemes other than http and https", () => {
    for (const url of [
      "file:///tmp/x",
      "ftp://allowed.example/",
      "gopher://allowed.example/",
      "data:text/plain,hi",
      "javascript:alert(1)",
      "ws://allowed.example/",
      "wss://allowed.example/",
    ]) {
      expect(refused(url)).toMatchObject({ reason: "scheme" });
    }
  });

  it("rejects userinfo and a port other than 80 or 443", () => {
    expect(refused("https://user:pass@allowed.example/")).toMatchObject({
      reason: "userinfo",
    });
    expect(refused("https://allowed.example:22/")).toMatchObject({
      reason: "port",
    });
  });

  it("rejects one address in each non-public class", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.1",
      "100.64.0.1",
      "169.254.1.1",
      "224.0.0.1",
      "240.0.0.1",
      "192.0.2.1",
      "0.0.0.1",
      "255.255.255.255",
      "[::1]",
      "[fc00::1]",
      "[fe80::1]",
      "[::ffff:10.0.0.1]",
    ]) {
      expect(refused(`http://${host}/`)).toMatchObject({
        reason: "non_public_address",
      });
    }
  });

  it("rejects unrecognized IPv6 forms", () => {
    for (const url of [
      "http://[::]/",
      "http://[::127.0.0.1]/",
      "http://[ff02::1]/",
    ]) {
      expect(refused(url)).toMatchObject({ reason: "non_public_address" });
    }
  });

  it("rejects obfuscated loopback forms before a connection", () => {
    for (const url of [
      "http://2130706433/",
      "http://0177.0.0.1/",
      "http://0x7f.0.0.1/",
      "http://127.1/",
      "http://127.0.0.1./",
    ]) {
      expect(refused(url)).toMatchObject({ reason: "non_public_address" });
    }
  });

  it("rejects metadata by name and by address", () => {
    expect(refused("http://metadata.google.internal/latest")).toMatchObject({
      reason: "metadata",
    });
    expect(refused("http://169.254.169.254/")).toMatchObject({
      reason: "metadata",
    });
  });

  it("allows the stub public address and pins it", () => {
    const resolve = publicResolver("allowed.example");
    const { connect, calls } = harness();
    const decision = checkFetch({
      url: "https://allowed.example/path",
      ceilings,
      resolve,
      connect,
      observed: atCeiling,
    });
    expect(decision).toEqual({ decision: "allow", pinned: "1.2.3.4" });
    expect(calls).toEqual(["1.2.3.4"]);
  });

  it("rejects rebinding and mixed answers", () => {
    const cases: Resolver[] = [
      (_host, phase) => (phase === "validation" ? ["1.2.3.4"] : ["10.0.0.1"]),
      () => ["1.2.3.4", "10.0.0.1"],
      () => ["1.2.3.4", "fc00::1"],
    ];
    for (const resolve of cases) {
      const { connect, calls } = harness();
      const decision = checkFetch({
        url: "https://allowed.example/",
        ceilings,
        resolve,
        connect,
        observed: atCeiling,
      });
      expect(decision).toEqual({ decision: "refused", reason: "rebinding" });
      expect(calls).toEqual([]);
    }
  });

  it("re-checks redirects and enforces the hop ceiling", () => {
    const resolve = (host: string) =>
      host.endsWith(".example") ? ["1.2.3.4"] : ["10.0.0.1"];
    const { connect, calls } = harness();
    const chain = [
      "https://allowed.example/",
      "https://hop1.example/",
      "https://hop2.example/",
      "https://hop3.example/",
    ];
    const allowed = checkFetch({
      url: chain[0],
      ceilings,
      resolve,
      connect,
      observed: atCeiling,
      redirectTo(url) {
        const index = chain.indexOf(url);
        return index >= 0 && index < chain.length - 1 ? chain[index + 1] : null;
      },
    });
    expect(allowed).toEqual({ decision: "allow", pinned: "1.2.3.4" });
    expect(calls).toEqual(["1.2.3.4"]);

    const privateHop = checkFetch({
      url: "https://allowed.example/",
      ceilings,
      resolve,
      connect: () => {
        throw new Error("connector must not run");
      },
      redirectTo: () => "http://10.0.0.1/",
    });
    expect(privateHop).toEqual({ decision: "refused", reason: "redirect" });

    const fileHop = checkFetch({
      url: "https://allowed.example/",
      ceilings,
      resolve,
      connect: () => {
        throw new Error("connector must not run");
      },
      redirectTo: () => "file:///tmp/x",
    });
    expect(fileHop).toEqual({ decision: "refused", reason: "redirect" });

    const loop = checkFetch({
      url: "https://allowed.example/a",
      ceilings,
      resolve,
      connect: () => {
        throw new Error("connector must not run");
      },
      redirectTo: () => "https://allowed.example/a",
    });
    expect(loop).toEqual({ decision: "refused", reason: "redirect" });

    const fourth = checkFetch({
      url: "https://a.example/",
      ceilings,
      resolve,
      connect: () => {
        throw new Error("connector must not run");
      },
      redirectTo(url) {
        const names = ["a", "b", "c", "d", "e"];
        const current = names.findIndex((name) =>
          url.startsWith(`https://${name}.example`),
        );
        const next = names[current + 1];
        return next ? `https://${next}.example/` : null;
      },
    });
    expect(fourth).toEqual({ decision: "refused", reason: "redirect" });
  });

  it("does not fetch a private, metadata, or off-host link", () => {
    const resolve: Resolver = (host) => {
      if (host === "other.example") return ["1.2.3.4"];
      throw new Error(`unexpected lookup ${host}`);
    };
    const cases = [
      ["http://10.0.0.1/map", "non_public_address"],
      ["http://169.254.169.254/", "metadata"],
      ["https://other.example/page", "off_host"],
    ] as const;
    for (const [url, reason] of cases) {
      const calls: string[] = [];
      const decision = checkLinkedUrl({
        targetHost: "allowed.example",
        url,
        resolve,
        connect(pinned) {
          calls.push(pinned);
        },
      });
      expect(decision).toEqual({ decision: "refused", reason });
      expect(calls).toEqual([]);
    }
  });

  it("allows a ceiling and refuses one step past it", () => {
    expect(checkLimits(atCeiling, ceilings)).toEqual({ decision: "allow" });
    const steps = [
      ["response_bytes", ceilings.response_bytes + 1],
      ["decompressed_bytes", ceilings.decompressed_bytes + 1],
      ["pages", ceilings.pages + 1],
      ["depth", ceilings.depth + 1],
      ["duration_ms", ceilings.duration_ms + 1],
    ] as const;
    for (const [key, value] of steps) {
      expect(checkLimits({ ...atCeiling, [key]: value }, ceilings)).toEqual({
        decision: "refused",
        reason: "over_limit",
      });
    }
  });

  it("labels a representative result as a sample", () => {
    expect(discloseSample(2)).toEqual({
      coverage: "sample",
      fetched_count: 2,
      site_wide_count: null,
    });
    expect(
      acceptsDisclosure({
        coverage: "full",
        fetched_count: 2,
        site_wide_count: 2,
      }),
    ).toBe(false);
  });

  it("keeps secret, database, and write-class names off the fetch path", () => {
    const python = readFileSync(
      path.join(root, "scripts/check_config.py"),
      "utf8",
    );
    const block = python.match(/WRITE_CLASS_TOOLS = \{([^}]+)\}/);
    if (!block) {
      throw new Error("WRITE_CLASS_TOOLS block missing");
    }
    const fromPython = new Set(
      [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    );
    expect(new Set(denylist.write_class_tools)).toEqual(fromPython);
    const needles = [...denylist.clients, ...denylist.write_class_tools];
    const dir = path.join(root, "apps/web/src/ssrf");
    const sources = readdirSync(dir).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const text = readFileSync(path.join(dir, name), "utf8");
      for (const needle of needles) {
        expect(text.includes(needle), `${name} contains ${needle}`).toBe(false);
      }
    }
  });
});
