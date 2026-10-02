import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function keyPaths(value: JsonValue, prefix = ""): string[] {
  if (typeof value === "string") {
    return [prefix];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      keyPaths(entry, prefix === "" ? `[${index}]` : `${prefix}[${index}]`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) =>
      keyPaths(entry, prefix === "" ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
}

function nonEmptyStrings(value: JsonValue): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(nonEmptyStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(nonEmptyStrings);
  }
  return [];
}

describe("message catalog parity", () => {
  it("en and ar expose identical key paths", () => {
    expect(keyPaths(en as JsonValue).sort()).toEqual(keyPaths(ar as JsonValue).sort());
  });

  it("contains no empty strings", () => {
    for (const [name, catalog] of [
      ["en", en],
      ["ar", ar],
    ] as const) {
      const strings = nonEmptyStrings(catalog as JsonValue);
      expect(strings.length).toBeGreaterThan(0);
      for (const text of strings) {
        expect(text.trim().length, `${name} catalog has an empty string`).toBeGreaterThan(0);
      }
    }
  });
});
