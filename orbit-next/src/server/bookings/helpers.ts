import { randomUUID } from "crypto";

import { and, asc, eq, gt, or } from "drizzle-orm";

import { storage } from "@/server/core";
import { emailService } from "@/server/emailService";
import { db } from "@/server/config";
import { BOOKING_MAX_DURATION_MS, BOOKING_MIN_DURATION_MS } from "@shared/bookingRules";
import { facilityBookings, type Facility, type FacilityBooking } from "@shared/schema";

const LIBRARY_OPEN_MINUTES = 7 * 60 + 30; // 7:30 AM
const LIBRARY_CLOSE_MINUTES = 19 * 60; // 7:00 PM

export interface ValidationError {
  status: number;
  body: Record<string, unknown>;
}

export type ValidationResult<T = void> = { ok: true; value: T } | { ok: false; error: ValidationError };

export function isWithinLibraryHours(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= LIBRARY_OPEN_MINUTES && totalMinutes <= LIBRARY_CLOSE_MINUTES;
}

export function formatLibraryHours(): string {
  return "7:30 AM - 7:00 PM";
}

export function validateLibraryHours(start: Date, end: Date): ValidationResult {
  if (!isWithinLibraryHours(start)) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { message: `Start time must be within school working hours (${formatLibraryHours()})` },
      },
    };
  }

  if (!isWithinLibraryHours(end)) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { message: `End time must be within school working hours (${formatLibraryHours()})` },
      },
    };
  }

  return { ok: true, value: undefined };
}

export function validateSameDay(start: Date, end: Date): ValidationResult {
  if (
    start.getFullYear() !== end.getFullYear() ||
    start.getMonth() !== end.getMonth() ||
    start.getDate() !== end.getDate()
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        body: {
          message:
            "Bookings must start and end on the same calendar day. For multi-day events please create separate bookings for each day.",
        },
      },
    };
  }

  return { ok: true, value: undefined };
}

export async function getFacilityOrError(facilityId: number): Promise<ValidationResult<Facility>> {
  const facility = await storage.getFacility(facilityId);
  if (!facility) {
    return {
      ok: false,
      error: { status: 404, body: { message: "Facility not found." } },
    };
  }
  return { ok: true, value: facility };
}

export async function ensureFacilityIsBookable(
  userId: string,
  facility: Facility,
  participants: number,
  start: Date,
  end: Date,
): Promise<ValidationResult<{ isFacultyOrAdmin: boolean }>> {
  if (!facility.isActive) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { message: "This facility is currently unavailable for booking. Please select another facility." },
      },
    };
  }

  if (participants > facility.capacity) {
    return {
      ok: false,
      error: {
        status: 400,
        body: {
          message: `Number of participants (${participants}) exceeds facility capacity (${facility.capacity}). Please reduce the number of participants or choose a larger facility.`,
          facilityCapacity: facility.capacity,
          requestedParticipants: participants,
        },
      },
    };
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0) {
    return {
      ok: false,
      error: { status: 400, body: { message: "End time must be after start time." } },
    };
  }
  if (durationMs < BOOKING_MIN_DURATION_MS) {
    return {
      ok: false,
      error: { status: 400, body: { message: "Booking duration must be at least 30 minutes." } },
    };
  }

  let isFacultyOrAdmin = false;
  try {
    const user = await storage.getUser(userId);
    isFacultyOrAdmin = !!user && (user.role === "faculty" || user.role === "admin");
  } catch (error) {
    console.warn("[bookings] Failed to determine user role", error);
  }

  if (durationMs > BOOKING_MAX_DURATION_MS) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { message: "Bookings exceeding the maximum allowed duration are not permitted." },
      },
    };
  }

  const facilityName = String(facility.name || "").toLowerCase();
  const restrictedByName = facilityName.includes("board room") || facilityName.includes("lounge");
  if (restrictedByName && !isFacultyOrAdmin) {
    return {
      ok: false,
      error: {
        status: 403,
        body: {
          message: "This facility is restricted to faculty members. Please contact an administrator if you require access.",
        },
      },
    };
  }

  return { ok: true, value: { isFacultyOrAdmin } };
}

export interface ConflictResult {
  cancelledConflicts: Array<{ id: string; facilityId: number; startTime: Date; endTime: Date; status: string }>;
}

export async function enforceUserBookingConflicts(
  userId: string,
  start: Date,
  end: Date,
  forceCancelConflicts: boolean,
): Promise<ValidationResult<ConflictResult>> {
  const cancelledConflicts: ConflictResult["cancelledConflicts"] = [];

  try {
    const allUserBookings = await storage.getFacilityBookingsByUser(userId);
    const nowMs = Date.now();

    // "Active" means a booking currently in progress, not just any future booking.
    const activeBookings = (allUserBookings || []).filter((b: any) => {
      const st = b.startTime ? new Date(b.startTime).getTime() : 0;
      const et = b.endTime ? new Date(b.endTime).getTime() : 0;
      return b.status === "approved" && st <= nowMs && et > nowMs;
    });

    if (activeBookings.length > 0 && !forceCancelConflicts) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            error: "UserHasActiveBooking",
            message:
              "You already have an active booking. Only one active booking is allowed per user. Please cancel your existing booking before creating a new one.",
            activeBookings: activeBookings.map((b: any) => ({
              id: b.id,
              facilityId: b.facilityId,
              startTime: b.startTime,
              endTime: b.endTime,
              status: b.status,
            })),
          },
        },
      };
    }

    if (activeBookings.length > 0 && forceCancelConflicts) {
      for (const b of activeBookings) {
        try {
          const endTime = new Date(b.endTime).getTime();
          if (endTime <= nowMs) continue;
          await storage.updateFacilityBooking(b.id, {
            status: "cancelled",
            adminResponse: `Cancelled by user (${userId}) to create a new booking`,
            updatedAt: new Date(),
          } as any);
          cancelledConflicts.push({
            id: b.id,
            facilityId: b.facilityId,
            startTime: new Date(b.startTime),
            endTime: new Date(b.endTime),
            status: "cancelled",
          });
        } catch (error) {
          console.warn("[bookings] Failed to cancel existing active booking", b.id, error);
        }
      }
    }

    const overlapping = (allUserBookings || []).filter((b: any) => {
      const st = b.startTime ? new Date(b.startTime).getTime() : 0;
      const et = b.endTime ? new Date(b.endTime).getTime() : 0;
      return (b.status === "approved" || b.status === "pending") && st < end.getTime() && et > start.getTime();
    });

    if (overlapping.length > 0 && !forceCancelConflicts) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            error: "UserHasOverlappingBooking",
            message:
              "You already have another booking (pending or approved) that overlaps this time. Please cancel or wait for your existing booking to end before creating a new one.",
            conflictingBookings: overlapping.map((b: any) => ({
              id: b.id,
              facilityId: b.facilityId,
              startTime: b.startTime,
              endTime: b.endTime,
              status: b.status,
            })),
          },
        },
      };
    }

    if (overlapping.length > 0 && forceCancelConflicts) {
      for (const b of overlapping) {
        try {
          const endTime = new Date(b.endTime).getTime();
          if (endTime <= nowMs) continue;
          await storage.updateFacilityBooking(b.id, {
            status: "cancelled",
            adminResponse: `Cancelled by user (${userId}) to create a new booking`,
            updatedAt: new Date(),
          } as any);
          cancelledConflicts.push({
            id: b.id,
            facilityId: b.facilityId,
            startTime: new Date(b.startTime),
            endTime: new Date(b.endTime),
            status: "cancelled",
          });
        } catch (error) {
          console.warn("[bookings] Failed to cancel overlapping booking", b.id, error);
        }
      }
    }
  } catch (error) {
    console.warn("[bookings] Failed to fetch or check user bookings", error);
  }

  return { ok: true, value: { cancelledConflicts } };
}

export interface BookingNotificationContext {
  booking: FacilityBooking;
  facility: Facility;
  userId: string;
  startTime: Date;
  endTime: Date;
}

export async function sendBookingNotifications({
  booking,
  facility,
  userId,
  startTime,
  endTime,
}: BookingNotificationContext): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (user?.email) {
      await emailService.sendBookingConfirmation(booking, user, facility.name);
    }
  } catch (error) {
    console.warn("[booking] Failed to send booking confirmation email", error);
  }

  try {
    const user = await storage.getUser(userId);
    const facilityInfo = facility ?? (await storage.getFacility(booking.facilityId));
    const userEmail = user?.email || "Unknown User";
    const notificationMessage = `${userEmail} submitted a booking request for ${facilityInfo?.name || `Facility ${booking.facilityId}`} from ${startTime.toLocaleString()} to ${endTime.toLocaleString()}.`;

    await storage.createSystemAlert({
      id: randomUUID(),
      type: "booking",
      severity: "low",
      title: "Booking Request Submitted",
      message: notificationMessage,
      userId: null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await storage.createSystemAlert({
      id: randomUUID(),
      type: "booking",
      severity: "low",
      title: "Booking Pending Approval",
      message: `Your booking request for ${facilityInfo?.name || `Facility ${booking.facilityId}`} on ${startTime.toLocaleString()} was submitted and is waiting for administrator approval.`,
      userId,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const equipment: any = (booking as any).equipment;
    const hasItems = equipment && Array.isArray(equipment.items) && equipment.items.length > 0;
    const hasOthers = equipment && equipment.others;

    if (hasItems || hasOthers) {
      try {
        const alerts = await storage.getSystemAlerts();
        const equipmentAlerts = alerts.filter(
          (alert: any) =>
            alert.userId === userId &&
            alert.title &&
            (alert.title.includes("Equipment") || alert.title.includes("Needs"))
        );

        for (const alert of equipmentAlerts) {
          await storage.updateSystemAlert(alert.id, { isRead: true } as any);
        }
      } catch (error) {
        console.warn("[booking] Failed to clean up old equipment alerts", error);
      }

      const bookingTime = startTime.toLocaleString();
      const facilityName = facilityInfo?.name || `Facility ${booking.facilityId}`;
      
      // Create admin notification (global - no userId)
      const adminMessage = `${userEmail} submitted an equipment request for ${facilityName} on ${bookingTime}. [Equipment: ${JSON.stringify(equipment)}]`;
      await storage.createSystemAlert({
        id: randomUUID(),
        type: "booking",
        severity: "low",
        title: "Equipment or Needs Request",
        message: adminMessage,
        userId: null,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create user notification (user-specific)
      const userMessage = `You submitted an equipment request for ${facilityName} on ${bookingTime}. Equipment at ${new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ')} [Equipment: ${JSON.stringify(equipment)}]`;
      await storage.createSystemAlert({
        id: randomUUID(),
        type: "user",
        severity: "low",
        title: "Equipment or Needs Request",
        message: userMessage,
        userId,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.warn("[booking] Failed to create booking alerts", error);
  }
}

export async function setArrivalConfirmationDeadline(bookingId: string, startTime: Date): Promise<void> {
  try {
    const arrivalDeadline = new Date(startTime.getTime() + 15 * 60 * 1000);
    await storage.updateFacilityBooking(bookingId, {
      arrivalConfirmationDeadline: arrivalDeadline,
      arrivalConfirmed: false,
      status: "approved",
      updatedAt: new Date(),
    } as any);
  } catch (error) {
    console.warn("[booking] Failed to set arrival confirmation deadline", error);
  }
}

export async function refreshBooking(bookingId: string): Promise<FacilityBooking | null> {
  try {
    return (await storage.getFacilityBooking(bookingId)) ?? null;
  } catch (error) {
    console.warn("[booking] Failed to refresh booking", error);
    return null;
  }
}

export async function fetchFacilityBookingsForAvailability(facilityId: number, userId: string) {
  const now = new Date();

  const activeBookings = await db
    .select()
    .from(facilityBookings)
    .where(
      and(
        eq(facilityBookings.facilityId, facilityId),
        or(eq(facilityBookings.status, "approved"), eq(facilityBookings.status, "pending")),
        gt(facilityBookings.endTime, now),
      ),
    )
    .orderBy(asc(facilityBookings.startTime));

  const requester = await storage.getUser(userId);
  if (requester?.role === "admin") {
    return activeBookings;
  }

  return activeBookings.filter((booking: any) => {
    if (booking.status === "approved") return true;
    if (booking.userId === userId) return true;
    return false;
  });
}
