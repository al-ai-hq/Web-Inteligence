import { describe, it, expect } from "vitest";
import { isWithinChangeWindow, type ChangeWindow } from "../src/change-window.js";

describe("isWithinChangeWindow", () => {
  it("allows Tier 1 changes outside window", () => {
    const window: ChangeWindow = {
      project_id: "p1",
      day_of_week: 2,
      start_time: "10:00",
      end_time: "12:00",
      timezone: "UTC",
    };
    const now = new Date("2026-10-13T15:00:00Z");
    expect(isWithinChangeWindow(1, window, now)).toBe(true);
  });

  it("rejects Tier 3 changes outside window", () => {
    const window: ChangeWindow = {
      project_id: "p1",
      day_of_week: 2,
      start_time: "10:00",
      end_time: "12:00",
      timezone: "UTC",
    };
    const now = new Date("2026-10-13T15:00:00Z");
    expect(isWithinChangeWindow(3, window, now)).toBe(false);
  });

  it("allows Tier 3 changes within window", () => {
    const window: ChangeWindow = {
      project_id: "p1",
      day_of_week: 2,
      start_time: "10:00",
      end_time: "12:00",
      timezone: "UTC",
    };
    const now = new Date("2026-10-13T10:30:00Z");
    expect(isWithinChangeWindow(3, window, now)).toBe(true);
  });
});
