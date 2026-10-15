import type { SchemaDiff } from "./types.js";

export function diffSchema(
  existing: Record<string, unknown>,
  proposed: Record<string, unknown>,
): SchemaDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { path: string; old_value: unknown; new_value: unknown }[] = [];

  for (const key of Object.keys(proposed)) {
    if (!(key in existing)) {
      added.push(key);
    } else if (JSON.stringify(existing[key]) !== JSON.stringify(proposed[key])) {
      changed.push({ path: key, old_value: existing[key], new_value: proposed[key] });
    }
  }

  for (const key of Object.keys(existing)) {
    if (!(key in proposed)) {
      removed.push(key);
    }
  }

  return { added, removed, changed };
}
