export type Reason =
  | "scheme"
  | "userinfo"
  | "port"
  | "non_public_address"
  | "metadata"
  | "rebinding"
  | "redirect"
  | "off_host"
  | "over_limit";

export type Decision =
  | { decision: "allow"; pinned: string }
  | { decision: "refused"; reason: Reason };

export type Ceilings = {
  role: "test_ceiling_not_product_limit";
  redirect_hops: number;
  response_bytes: number;
  decompressed_bytes: number;
  pages: number;
  depth: number;
  duration_ms: number;
};

export type Observed = {
  response_bytes: number;
  decompressed_bytes: number;
  pages: number;
  depth: number;
  duration_ms: number;
};

export type Resolver = (
  host: string,
  phase: "validation" | "connection",
) => readonly string[];

export type Connector = (pinned: string) => void;

export type FetchInput = {
  url: string;
  ceilings: Ceilings;
  resolve: Resolver;
  connect: Connector;
  redirectTo?: (url: string) => string | null;
  observed?: Observed;
};

const METADATA_NAME = "metadata.google.internal";

function refused(reason: Reason): Decision {
  return { decision: "refused", reason };
}

function ip(a: number, b: number, c: number, d: number): number {
  return ((a * 256 + b) * 256 + c) * 256 + d;
}

function mask(bits: number): number {
  if (bits <= 0) return 0;
  return (0xffffffff << (32 - bits)) >>> 0;
}

function inBlock(value: number, base: number, bits: number): boolean {
  const bitsMask = mask(bits);
  return (value & bitsMask) === (base & bitsMask);
}

function parseDotted(host: string): number | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => part > 255)) return null;
  return ip(parts[0], parts[1], parts[2], parts[3]);
}

function addressClass(value: number): "metadata" | "non_public" | "public" {
  if (value === ip(169, 254, 169, 254)) return "metadata";
  if (value === 0xffffffff) return "non_public";
  if (
    inBlock(value, ip(0, 0, 0, 0), 8) ||
    inBlock(value, ip(10, 0, 0, 0), 8) ||
    inBlock(value, ip(100, 64, 0, 0), 10) ||
    inBlock(value, ip(127, 0, 0, 0), 8) ||
    inBlock(value, ip(169, 254, 0, 0), 16) ||
    inBlock(value, ip(172, 16, 0, 0), 12) ||
    inBlock(value, ip(192, 0, 2, 0), 24) ||
    inBlock(value, ip(192, 168, 0, 0), 16) ||
    inBlock(value, ip(198, 51, 100, 0), 24) ||
    inBlock(value, ip(203, 0, 113, 0), 24) ||
    inBlock(value, ip(224, 0, 0, 0), 4) ||
    inBlock(value, ip(240, 0, 0, 0), 4)
  ) {
    return "non_public";
  }
  return "public";
}

function expandV6(host: string): number[] | null {
  const lower = host.toLowerCase();
  if (!/^[0-9a-f:]+$/.test(lower)) return null;
  const halves = lower.split("::");
  if (halves.length > 2) return null;
  const side = (text: string): number[] | null => {
    if (text === "") return [];
    const groups = text.split(":");
    const numbers = groups.map((group) => Number.parseInt(group, 16));
    if (
      numbers.some(
        (group) => !Number.isInteger(group) || group < 0 || group > 0xffff,
      )
    ) {
      return null;
    }
    return numbers;
  };
  const head = side(halves[0]);
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const tail = side(halves[1]);
  if (!tail) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...Array<number>(missing).fill(0), ...tail];
}

function embeddedV4(high: number, low: number): number {
  return high * 0x10000 + low;
}

function classifyV6(groups: number[]): "metadata" | "non_public" | "public" {
  if (groups.every((group) => group === 0)) return "non_public";
  const leadingZero = (count: number) =>
    groups.slice(0, count).every((group) => group === 0);
  if (leadingZero(5) && groups[5] === 0xffff) {
    return addressClass(embeddedV4(groups[6], groups[7]));
  }
  if (leadingZero(6)) return addressClass(embeddedV4(groups[6], groups[7]));
  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return "non_public";
  if ((first & 0xffc0) === 0xfe80) return "non_public";
  if ((first & 0xff00) === 0xff00) return "non_public";
  if (first === 0x2001 && groups[1] === 0x0db8) return "non_public";
  if (first === 0x2002) return addressClass(embeddedV4(groups[1], groups[2]));
  if (
    first === 0x0064 &&
    groups[1] === 0xff9b &&
    groups.slice(2, 6).every((group) => group === 0)
  ) {
    return addressClass(embeddedV4(groups[6], groups[7]));
  }
  if ((first & 0xe000) === 0x2000) return "public";
  return "non_public";
}

function classifyLiteral(
  host: string,
): "metadata" | "non_public" | "public" | null {
  const dotted = parseDotted(host);
  if (dotted !== null) return addressClass(dotted);
  const groups = expandV6(host);
  if (!groups) return null;
  return classifyV6(groups);
}

function bareHost(hostname: string): string {
  const unwrapped =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  return unwrapped.endsWith(".") ? unwrapped.slice(0, -1) : unwrapped;
}

function judgeAnswers(
  answers: readonly string[],
): { kind: "pin"; pinned: string } | { kind: "stop"; reason: Reason } {
  if (answers.length === 0)
    return { kind: "stop", reason: "non_public_address" };
  const classes = answers.map(
    (answer) => classifyLiteral(answer) ?? "non_public",
  );
  if (classes.includes("metadata")) return { kind: "stop", reason: "metadata" };
  const publicCount = classes.filter((kind) => kind === "public").length;
  if (publicCount !== answers.length) {
    return {
      kind: "stop",
      reason: publicCount > 0 ? "rebinding" : "non_public_address",
    };
  }
  if (new Set(answers).size !== 1) return { kind: "stop", reason: "rebinding" };
  return { kind: "pin", pinned: answers[0] };
}

function classifyHost(host: string, resolve: Resolver): Decision {
  const bare = bareHost(host);
  if (bare.toLowerCase() === METADATA_NAME) return refused("metadata");
  const literal = classifyLiteral(bare);
  if (literal === "metadata") return refused("metadata");
  if (literal === "non_public") return refused("non_public_address");
  if (literal === "public") return { decision: "allow", pinned: bare };
  const validation = judgeAnswers(resolve(bare, "validation"));
  if (validation.kind === "stop") return refused(validation.reason);
  const connection = resolve(bare, "connection");
  if (connection.length !== 1 || connection[0] !== validation.pinned) {
    return refused("rebinding");
  }
  return { decision: "allow", pinned: validation.pinned };
}

function classifyUrl(url: string, resolve: Resolver): Decision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return refused("scheme");
  }
  const scheme = parsed.protocol.slice(0, -1);
  if (scheme !== "http" && scheme !== "https") return refused("scheme");
  if (parsed.username !== "" || parsed.password !== "")
    return refused("userinfo");
  const port =
    parsed.port === "" ? (scheme === "https" ? 443 : 80) : Number(parsed.port);
  if (port !== 80 && port !== 443) return refused("port");
  if (parsed.hostname === "") return refused("non_public_address");
  return classifyHost(parsed.hostname, resolve);
}

export function checkLimits(
  observed: Observed,
  ceilings: Ceilings,
): { decision: "allow" } | { decision: "refused"; reason: "over_limit" } {
  if (
    observed.response_bytes > ceilings.response_bytes ||
    observed.decompressed_bytes > ceilings.decompressed_bytes ||
    observed.pages > ceilings.pages ||
    observed.depth > ceilings.depth ||
    observed.duration_ms > ceilings.duration_ms
  ) {
    return { decision: "refused", reason: "over_limit" };
  }
  return { decision: "allow" };
}

export function checkFetch(input: FetchInput): Decision {
  const redirectTo = input.redirectTo ?? (() => null);
  const seen = new Set<string>();
  let current = input.url;
  let followed = false;
  let hops = 0;
  for (;;) {
    if (seen.has(current)) return refused("redirect");
    seen.add(current);
    const classified = classifyUrl(current, input.resolve);
    if (classified.decision === "refused") {
      return followed ? refused("redirect") : classified;
    }
    const next = redirectTo(current);
    if (next === null) {
      if (input.observed) {
        const limited = checkLimits(input.observed, input.ceilings);
        if (limited.decision === "refused") return limited;
      }
      input.connect(classified.pinned);
      return classified;
    }
    followed = true;
    hops += 1;
    if (hops > input.ceilings.redirect_hops) return refused("redirect");
    current = next;
  }
}

export function checkLinkedUrl(input: {
  targetHost: string;
  url: string;
  resolve: Resolver;
  connect: Connector;
}): Decision {
  const classified = classifyUrl(input.url, input.resolve);
  if (classified.decision === "refused") return classified;
  const host = bareHost(new URL(input.url).hostname).toLowerCase();
  const target = bareHost(input.targetHost).toLowerCase();
  if (host !== target) return refused("off_host");
  return classified;
}
