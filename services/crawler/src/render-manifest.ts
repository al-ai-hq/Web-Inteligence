// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RenderManifestEntry {
  url: string;
  textByteLength: number;
}

export interface RenderManifest {
  entries: RenderManifestEntry[];
  threshold: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
export function shouldRender(textBytes: number, threshold: number): boolean {
  return textBytes < threshold;
}

export function createManifest(threshold: number): RenderManifest {
  return { entries: [], threshold };
}

export function addToManifest(
  manifest: RenderManifest,
  url: string,
  textByteLength: number
): RenderManifest {
  if (!shouldRender(textByteLength, manifest.threshold)) {
    return manifest;
  }
  return {
    ...manifest,
    entries: [...manifest.entries, { url, textByteLength }],
  };
}

export function serializeManifest(manifest: RenderManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function parseManifest(json: string): RenderManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid render manifest format");
  }
  // Basic validation
  const obj = parsed as Record<string, unknown> | null;
  if (
    !obj ||
    !Array.isArray(obj["entries"]) ||
    typeof obj["threshold"] !== "number"
  ) {
    throw new Error("Invalid render manifest format");
  }
  return obj as unknown as RenderManifest;
}
