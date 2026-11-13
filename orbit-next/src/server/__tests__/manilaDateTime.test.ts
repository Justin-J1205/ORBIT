import { describe, expect, it } from "vitest";

import { getManilaDateTimeInputs, manilaDateTimeToIso } from "../../shared/manilaDateTime";

describe("Manila date-time input helpers", () => {
  it("formats booking instants as Manila calendar dates and clock times", () => {
    expect(getManilaDateTimeInputs("2026-11-12T23:30:00.000Z")).toEqual({
      date: "2026-11-13",
      time: "07:30",
    });
  });

  it("combines the selected Manila date and time into the corresponding UTC instant", () => {
    expect(manilaDateTimeToIso("2026-11-13", "07:30")).toBe("2026-11-12T23:30:00.000Z");
  });

  it("rejects invalid date and time input values", () => {
    expect(manilaDateTimeToIso("2026-02-30", "09:30")).toBeNull();
    expect(manilaDateTimeToIso("2026-11-13", "24:00")).toBeNull();
    expect(manilaDateTimeToIso("", "")).toBeNull();
  });
});
