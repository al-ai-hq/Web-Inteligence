import { describe, it, expect } from "vitest";
import { transitionState, type ApprovalState } from "../src/state-machine.js";

describe("transitionState", () => {
  it("transitions draft → validated when checks pass", () => {
    const result = transitionState("draft", "validated", { checksPassed: true });
    expect(result.ok).toBe(true);
    expect(result.newState).toBe("validated");
  });

  it("rejects draft → validated when checks fail", () => {
    const result = transitionState("draft", "validated", { checksPassed: false });
    expect(result.ok).toBe(false);
  });

  it("transitions validated → previewed", () => {
    const result = transitionState("validated", "previewed", {});
    expect(result.ok).toBe(true);
  });

  it("transitions previewed → approved", () => {
    const result = transitionState("previewed", "approved", {});
    expect(result.ok).toBe(true);
  });

  it("allows rejection from any non-terminal state", () => {
    expect(transitionState("draft", "rejected", {}).ok).toBe(true);
    expect(transitionState("validated", "rejected", {}).ok).toBe(true);
    expect(transitionState("previewed", "rejected", {}).ok).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(transitionState("approved", "draft", {}).ok).toBe(false);
    expect(transitionState("rejected", "approved", {}).ok).toBe(false);
  });
});
