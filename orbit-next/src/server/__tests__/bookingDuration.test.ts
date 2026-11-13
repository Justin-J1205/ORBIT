import { describe, expect, it } from "vitest";

import {
  BOOKING_MAX_DURATION_MS,
  exceedsBookingDurationLimit,
} from "../../shared/bookingRules";
import { createBookingSchema } from "../../components/modals/booking/schemas/bookingSchema";

describe("booking duration limit", () => {
  it("allows admins to exceed two hours but rejects longer non-admin bookings", () => {
    const durationMs = BOOKING_MAX_DURATION_MS + 60 * 60 * 1000;

    expect(exceedsBookingDurationLimit(durationMs, true)).toBe(false);
    expect(exceedsBookingDurationLimit(durationMs, false)).toBe(true);
  });

  it("applies the role-specific duration limit in the booking form schema", () => {
    const startTime = new Date("2026-11-12T08:00:00.000Z");
    const booking = {
      facilityId: "1",
      startTime,
      endTime: new Date(startTime.getTime() + BOOKING_MAX_DURATION_MS + 60 * 60 * 1000),
      purpose: "Meeting",
      participants: 2,
      name: "Test User",
      program: "Faculty",
    };

    expect(createBookingSchema(true).safeParse(booking).success).toBe(true);
    expect(createBookingSchema(false).safeParse(booking).success).toBe(false);
  });

  it("still rejects admin bookings whose end time is not after the start", () => {
    const startTime = new Date("2026-11-12T08:00:00.000Z");
    const result = createBookingSchema(true).safeParse({
      facilityId: "1",
      startTime,
      endTime: startTime,
      purpose: "Meeting",
      participants: 2,
      name: "Test User",
      program: "Faculty",
    });

    expect(result.success).toBe(false);
  });
});
