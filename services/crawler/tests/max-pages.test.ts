import { describe, expect, it } from "vitest";
import { resolveMaxPages } from "../src/max-pages.js";

describe("resolveMaxPages", () => {
  it("returns the config value when the env var is undefined", () => {
    expect(resolveMaxPages(10, undefined)).toBe(10);
  });

  it("returns the config value when the env var is empty", () => {
    expect(resolveMaxPages(10, "")).toBe(10);
  });

  it("returns the config value when the env var is not a number", () => {
    expect(resolveMaxPages(10, "not-a-number")).toBe(10);
  });

  it("clamps values below 1 up to 1", () => {
    expect(resolveMaxPages(10, "-5")).toBe(1);
    expect(resolveMaxPages(10, "0")).toBe(1);
  });

  it("clamps values above the config cap down to the cap", () => {
    expect(resolveMaxPages(10, "25")).toBe(10);
  });

  it("passes a valid in-range value through", () => {
    expect(resolveMaxPages(20, "7")).toBe(7);
  });
});
