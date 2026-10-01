import { Resolver } from "node:dns/promises";

const BLOCKED_RANGES = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "100.64.0.0/10",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

function isPrivateIp(ip: string): boolean {
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

export async function resolveDns(hostname: string): Promise<string[]> {
  const resolver = new Resolver();
  resolver.setServers(["8.8.8.8", "8.8.4.4"]);

  try {
    const addresses = await resolver.resolve4(hostname);
    const publicAddresses = addresses.filter((ip) => !isPrivateIp(ip));

    if (publicAddresses.length === 0) {
      throw new Error(`DNS resolution returned only non-public addresses for ${hostname}`);
    }

    return publicAddresses;
  } catch (error) {
    if (error instanceof Error && error.message.includes("non-public")) {
      throw error;
    }
    throw new Error(`DNS resolution failed for ${hostname}: ${error}`);
  }
}
