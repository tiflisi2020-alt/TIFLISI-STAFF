import { describe, expect, it } from "vitest";
import {
  addDays,
  dateKey,
  isWorking,
  mondayOf,
  prettyTime,
  restaurantToday,
  shiftHours,
} from "./schedule";

describe("schedule data semantics", () => {
  it("uses Tbilisi calendar dates regardless of browser timezone", () => {
    expect(restaurantToday(new Date("2026-10-13T21:00:00Z"))).toBe(
      "2026-10-14"
    );
    expect(restaurantToday(new Date("2026-10-13T18:00:00Z"))).toBe(
      "2026-10-13"
    );
  });
  it("does not fabricate duration when only a start time exists", () => {
    expect(shiftHours("14:00")).toBeNull();
    expect(shiftHours("9:00")).toBeNull();
    expect(prettyTime("9:00")).toBe("09:00");
  });
  it("calculates only explicitly recorded ranges including overnight", () => {
    expect(shiftHours("14:00 – 22:00")).toBe(8);
    expect(shiftHours("22:00-06:00")).toBe(8);
    expect(shiftHours("09:00 — 17:30")).toBe(8.5);
  });
  it("recognizes off and missing shifts", () => {
    expect(isWorking("OFF")).toBe(false);
    expect(isWorking("off")).toBe(false);
    expect(isWorking(null)).toBe(false);
    expect(isWorking("")).toBe(false);
    expect(isWorking("შვებულება")).toBe(false);
    expect(isWorking("14:00")).toBe(true);
  });
  it("starts weeks on Monday and handles month boundaries", () => {
    expect(dateKey(mondayOf(new Date("2026-10-13T12:00:00")))).toBe(
      "2026-10-12"
    );
    expect(dateKey(mondayOf(new Date("2026-10-18T12:00:00")))).toBe(
      "2026-10-12"
    );
    expect(dateKey(addDays(new Date("2026-10-31T12:00:00"), 1))).toBe(
      "2026-11-01"
    );
  });
});
