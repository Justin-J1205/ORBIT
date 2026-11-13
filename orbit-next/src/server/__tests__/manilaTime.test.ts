import { describe, expect, it } from "vitest";

import {
  getManilaDayBounds,
  getManilaDateParts,
  isSameManilaDay,
  isWithinManilaLibraryHours,
} from "../bookings/manilaTime";

describe("Manila booking time helpers", () => {
  it("evaluates working hours in Asia/Manila rather than the runtime timezone", () => {
    expect(isWithinManilaLibraryHours(new Date("2026-11-12T23:30:00.000Z"))).toBe(true);
    expect(isWithinManilaLibraryHours(new Date("2026-11-12T01:30:00.000Z"))).toBe(true);
    expect(isWithinManilaLibraryHours(new Date("2026-11-12T23:29:00.000Z"))).toBe(false);
    expect(isWithinManilaLibraryHours(new Date("2026-11-12T11:00:00.000Z"))).toBe(true);
    expect(isWithinManilaLibraryHours(new Date("2026-11-12T11:01:00.000Z"))).toBe(false);
  });

  it("compares Manila calendar dates across UTC midnight", () => {
    const start = new Date("2026-11-12T23:30:00.000Z");
    const end = new Date("2026-11-13T00:00:00.000Z");
    const beforeManilaMidnight = new Date("2026-11-12T15:59:59.000Z");
    const atManilaMidnight = new Date("2026-11-12T16:00:00.000Z");

    expect(isSameManilaDay(start, end)).toBe(true);
    expect(isSameManilaDay(beforeManilaMidnight, atManilaMidnight)).toBe(false);
    expect(getManilaDateParts(start)).toMatchObject({ year: 2026, month: 11, day: 13, hour: 7, minute: 30 });
  });

  it("returns UTC instants for Manila midnight bounds without mutating the input", () => {
    const date = new Date("2026-11-13T00:30:00.000Z");
    const originalTime = date.getTime();

    const bounds = getManilaDayBounds(date);

    expect(bounds.start.toISOString()).toBe("2026-11-12T16:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-13T15:59:59.999Z");
    expect(date.getTime()).toBe(originalTime);
  });
});
