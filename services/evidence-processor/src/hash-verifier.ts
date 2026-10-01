import { createHash } from "node:crypto";

export interface HashVerificationResult {
  match: boolean;
  expectedHash: string;
  computedHash: string;
}

export function verifyHash(content: string, expectedHash: string): HashVerificationResult {
  const computedHash = createHash("sha256").update(content).digest("hex");
  return {
    match: computedHash === expectedHash,
    expectedHash,
    computedHash,
  };
}
