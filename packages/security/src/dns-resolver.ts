import { Resolver } from "node:dns/promises";

function isPrivateIp(ip: string): boolean {
  // IPv4 checks
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4) return false;

    const [a, b] = parts;
    if (a === undefined || b === undefined) return false;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 192 && b === 0 && parts[2] === 2) return true;
    if (a === 198 && b === 51 && parts[2] === 100) return true;
    if (a === 203 && b === 0 && parts[2] === 113) return true;
    if (a >= 224 && a <= 239) return true;
    if (a >= 240) return true;

    return false;
  }

  // IPv6 checks
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("ff")) return true;

  return false;
}

class NonPublicDnsError extends Error {
  constructor(hostname: string) {
    super(`DNS resolution returned only non-public addresses for ${hostname}`);
    this.name = "NonPublicDnsError";
  }
}

export async function resolveDns(hostname: string): Promise<string[]> {
  const publicAddresses = await resolveWithFallback(hostname);

  if (publicAddresses.length === 0) {
    throw new NonPublicDnsError(hostname);
  }

  return publicAddresses;
}

async function resolveWithFallback(hostname: string): Promise<string[]> {
  try {
    return await resolveWithServers(hostname, ["8.8.8.8", "8.8.4.4"]);
  } catch {
    const systemResolver = new Resolver();
    return resolveWithResolver(systemResolver, hostname);
  }
}

async function resolveWithServers(hostname: string, servers: string[]): Promise<string[]> {
  const resolver = new Resolver();
  resolver.setServers(servers);
  return resolveWithResolver(resolver, hostname);
}

async function resolveWithResolver(resolver: Resolver, hostname: string): Promise<string[]> {
  try {
    const addresses = await resolver.resolve4(hostname);
    return addresses.filter((ip) => !isPrivateIp(ip));
  } catch (error) {
    if (error instanceof NonPublicDnsError) {
      throw error;
    }
    throw new Error(`DNS resolution failed for ${hostname}: ${error}`);
  }
}
