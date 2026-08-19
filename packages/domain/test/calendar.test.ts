import { describe, expect, it } from "vitest";
import { buildMonthlySlots, conceptCount, daysInMonth } from "../src/calendar";

describe("monthly calendar", () => {
  it("handles leap years and actual month length", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(conceptCount(2028, 2, 2)).toBe(58);
    expect(conceptCount(2026, 8, 3)).toBe(93);
  });

  it("creates deterministic slots for all selected channels", () => {
    const slots = buildMonthlySlots({
      year: 2026,
      month: 4,
      conceptsPerDay: 2,
      timezone: "Asia/Jakarta",
      times: ["09:00", "18:30"],
      channels: ["INSTAGRAM", "THREADS"]
    });
    expect(slots).toHaveLength(60);
    expect(slots[0]).toMatchObject({ localDate: "2026-04-01", localTime: "09:00" });
    expect(slots[59]).toMatchObject({ localDate: "2026-04-30", localTime: "18:30" });
  });

  it("rejects more than the plan limit", () => {
    expect(() => conceptCount(2026, 1, 4)).toThrow(RangeError);
  });
});
