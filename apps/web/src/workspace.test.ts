import { describe, expect, it } from "vitest";
import { packageName } from "./workspace";

describe("workspace", () => {
  it("names the only implemented package", () => {
    expect(packageName()).toBe("web");
  });
});
