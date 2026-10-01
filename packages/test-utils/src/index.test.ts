import { describe, it, expect } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("@wpi/test-utils", () => {
  it("exports a package name", () => {
    expect(PACKAGE_NAME).toBe("@wpi/test-utils");
  });
});
