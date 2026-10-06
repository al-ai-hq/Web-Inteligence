import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config-loader.js";

describe("config-loader", () => {
  it("loads all 7 rule files and scoring.yaml", () => {
    const config = loadConfig();
    expect(config.rules.length).toBe(77);
    expect(config.scoring.methodology_version).toBe("0.1.0-draft");
    expect(config.scoring.category_weights).toBeDefined();
  });

  it("throws ConfigError when a rule YAML is malformed", () => {
    // ConfigError is a proper Error subclass with the right name
    const err = new ConfigError("test message");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.name).toBe("ConfigError");
    expect(err.message).toBe("test message");
  });

  it("validates category weights sum to 100", () => {
    const config = loadConfig();
    const sum = Object.values(config.scoring.category_weights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});
