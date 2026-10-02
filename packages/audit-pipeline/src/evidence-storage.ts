import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { StorageReader } from "@wpi/agents";

export class FsEvidenceStorage implements StorageReader {
  constructor(private readonly outputDir: string) {}

  async read(_bucket: string, path: string): Promise<unknown> {
    const raw = await readFile(join(this.outputDir, path), "utf8");
    return JSON.parse(raw) as unknown;
  }
}
