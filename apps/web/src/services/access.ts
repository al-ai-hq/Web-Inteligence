import { timingSafeEqual } from "node:crypto";
import {
  hashAuditSecret,
  type AuditRecord,
  type AuditStore,
} from "@wpi/audit-pipeline";

export type AccessOutcome =
  | { kind: "authorized"; record: AuditRecord }
  | { kind: "not_found" }
  | { kind: "deleted" }
  | { kind: "expired" };

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function authorizeRecord(
  store: AuditStore,
  id: string,
  secret: string | undefined,
): Promise<AccessOutcome> {
  const raw = await store.getRaw(id);
  if (raw === null) {
    return { kind: "not_found" };
  }
  if (!hashesMatch(hashAuditSecret(secret ?? ""), raw.secret_hash)) {
    return { kind: "not_found" };
  }
  if (raw.deleted_at !== null) {
    return { kind: "deleted" };
  }
  if (new Date(raw.expires_at).getTime() <= Date.now()) {
    await store.transition(id, "EXPIRED").catch(() => undefined);
    return { kind: "expired" };
  }
  return { kind: "authorized", record: raw };
}
