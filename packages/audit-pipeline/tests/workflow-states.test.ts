import { describe, expect, it } from "vitest";
import {
  AUDIT_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  isTerminal,
} from "../src/workflow-states.js";

describe("workflow states", () => {
  it("exposes exactly the 12 contract statuses in pipeline order", () => {
    expect([...AUDIT_STATUSES]).toEqual([
      "QUEUED",
      "VALIDATING",
      "CRAWLING",
      "EXTRACTING",
      "AUDITING",
      "ENRICHING_OPTIONAL",
      "COMPOSING",
      "READY_PARTIAL",
      "READY_COMPLETE",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
    ]);
  });

  it("allows the happy path QUEUED through COMPOSING to READY_COMPLETE", () => {
    expect(canTransition("QUEUED", "VALIDATING")).toBe(true);
    expect(canTransition("VALIDATING", "CRAWLING")).toBe(true);
    expect(canTransition("CRAWLING", "EXTRACTING")).toBe(true);
    expect(canTransition("EXTRACTING", "AUDITING")).toBe(true);
    expect(canTransition("AUDITING", "COMPOSING")).toBe(true);
    expect(canTransition("COMPOSING", "READY_COMPLETE")).toBe(true);
    expect(canTransition("COMPOSING", "READY_PARTIAL")).toBe(true);
  });

  it("allows failure from every active stage", () => {
    expect(canTransition("VALIDATING", "FAILED")).toBe(true);
    expect(canTransition("CRAWLING", "FAILED")).toBe(true);
    expect(canTransition("EXTRACTING", "FAILED")).toBe(true);
    expect(canTransition("AUDITING", "FAILED")).toBe(true);
    expect(canTransition("ENRICHING_OPTIONAL", "FAILED")).toBe(true);
    expect(canTransition("COMPOSING", "FAILED")).toBe(true);
  });

  it("allows only EXPIRED out of terminal states", () => {
    expect(canTransition("READY_COMPLETE", "EXPIRED")).toBe(true);
    expect(canTransition("READY_PARTIAL", "EXPIRED")).toBe(true);
    expect(canTransition("FAILED", "EXPIRED")).toBe(true);
    expect(canTransition("CANCELLED", "EXPIRED")).toBe(true);
    expect(canTransition("READY_COMPLETE", "CRAWLING")).toBe(false);
    expect(canTransition("FAILED", "COMPOSING")).toBe(false);
    expect(canTransition("EXPIRED", "EXPIRED")).toBe(false);
  });

  it("rejects skips and backwards moves", () => {
    expect(canTransition("QUEUED", "CRAWLING")).toBe(false);
    expect(canTransition("CRAWLING", "VALIDATING")).toBe(false);
    expect(canTransition("QUEUED", "FAILED")).toBe(false);
  });

  it("classifies terminals", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal("CRAWLING")).toBe(false);
    expect(isTerminal("QUEUED")).toBe(false);
  });
});
