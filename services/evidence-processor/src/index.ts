import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyHash } from "./hash-verifier.js";
import { detectInjection } from "./injection-detector.js";
import { normalizeEvidence } from "./normalizer.js";
import type { RawEvidence } from "./normalizer.js";
import { mergeEvidence } from "./merger.js";
import type { RenderedEvidence } from "./merger.js";

export const EVIDENCE_PROCESSOR_VERSION = "0.0.0";

export interface EvidenceProcessorResult {
  auditId: string;
  evidenceProcessed: number;
  evidenceSkipped: number;
  outputDir: string;
}

/** 64 hex chars, optionally prefixed with "sha256:" */
const HASH_RE = /^(?:sha256:)?[0-9a-f]{64}$/i;

function urlToHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export async function runEvidenceProcessor(): Promise<EvidenceProcessorResult> {
  const auditId = process.env["AUDIT_ID"];
  if (!auditId) {
    throw new Error("AUDIT_ID environment variable is required");
  }

  const inputDir = process.env["INPUT_DIR"] ?? "./output";
  const outputDir = process.env["OUTPUT_DIR"] ?? "./output";

  const rawDir = join(inputDir, auditId, "raw");
  const renderedDir = join(inputDir, auditId, "rendered");
  const evidenceDir = join(outputDir, auditId, "evidence");

  if (!existsSync(rawDir)) {
    throw new Error(`Input directory does not exist: ${rawDir}`);
  }

  // Ensure output directory exists
  mkdirSync(evidenceDir, { recursive: true });

  // Discover raw evidence files
  const rawFiles = readdirSync(rawDir).filter((f) => f.endsWith(".json"));

  // Discover rendered evidence files (may not exist)
  const renderedFiles = new Set<string>();
  if (existsSync(renderedDir)) {
    for (const f of readdirSync(renderedDir)) {
      if (f.endsWith(".json")) {
        renderedFiles.add(f);
      }
    }
  }

  let evidenceProcessed = 0;
  let evidenceSkipped = 0;

  for (const rawFile of rawFiles) {
    const rawPath = join(rawDir, rawFile);

    // 1. Read raw JSON string
    let rawString: string;
    try {
      rawString = readFileSync(rawPath, "utf-8");
    } catch (err) {
      console.error(`Failed to read ${rawPath}: ${err}`);
      evidenceSkipped++;
      continue;
    }

    // 2. Parse JSON
    let raw: RawEvidence;
    try {
      raw = JSON.parse(rawString) as RawEvidence;
    } catch (err) {
      console.error(`Invalid JSON in ${rawPath}: ${err}`);
      evidenceSkipped++;
      continue;
    }

    // 3. Verify contentHash is well-formed (M1 hash verification)
    if (!HASH_RE.test(raw.contentHash)) {
      console.warn(`tampering detected: malformed contentHash in ${rawFile}`);
      evidenceSkipped++;
      continue;
    }

    // 4. Hash verification — detect tampering
    const storedHash = raw.contentHash.replace(/^sha256:/, "");
    if (!verifyHash(rawString, storedHash)) {
      console.warn(`tampering detected: contentHash mismatch in ${rawFile}`);
      evidenceSkipped++;
      continue;
    }

    // 5. Detect injection on serialized body content
    const bodyContent = JSON.stringify({
      headings: raw.headings,
      links: raw.links,
      structuredData: raw.structuredData,
      textByteLength: raw.textByteLength,
    });
    const injectionSuspected = detectInjection(bodyContent);

    // 6. Normalize
    const normalized = normalizeEvidence(raw, {
      auditId,
      injectionSuspected,
    });

    // 7. Look for matching rendered evidence
    const urlHash = urlToHash(raw.url);
    const renderedFile = `${urlHash}.json`;
    let rendered: RenderedEvidence | undefined;

    if (renderedFiles.has(renderedFile)) {
      try {
        const renderedPath = join(renderedDir, renderedFile);
        const renderedString = readFileSync(renderedPath, "utf-8");
        rendered = JSON.parse(renderedString) as RenderedEvidence;
      } catch (err) {
        console.warn(`Failed to read rendered ${renderedFile}: ${err}`);
        // Proceed without rendered evidence
      }
    }

    // 8. Merge
    const merged = mergeEvidence(normalized, rendered);

    // 9. Write output
    const outputPath = join(evidenceDir, `${urlHash}.json`);
    writeFileSync(outputPath, JSON.stringify(merged, null, 2), "utf-8");

    evidenceProcessed++;
  }

  return {
    auditId,
    evidenceProcessed,
    evidenceSkipped,
    outputDir: evidenceDir,
  };
}
