import { NextResponse, type NextRequest } from "next/server";

import { requireActiveUser } from "@/server/core";
import { storage } from "@/server/core";
import {
  validateLibraryHours,
  validateSameDay,
  getFacilityOrError,
  ensureFacilityIsBookable,
  enforceUserBookingConflicts,
  sendBookingNotifications,
  refreshBooking,
} from "@/server/bookings/helpers";
import { createFacilityBookingSchema } from "@shared/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await requireActiveUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const bookings = await storage.getFacilityBookingsByUser(authResult.user.id);
    return NextResponse.json(bookings ?? [], { status: 200 });
  } catch (error) {
    console.error("[bookings] Failed to fetch user bookings:", error);
    return NextResponse.json({ message: "Failed to fetch bookings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireActiveUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const rawBody = await request.json();

    const startTime = new Date(rawBody?.startTime);
    const endTime = new Date(rawBody?.endTime);
    const forceCancelConflicts = Boolean(rawBody?.forceCancelConflicts);

    const reminderOptIn = rawBody?.reminderOptIn === undefined ? true : Boolean(rawBody.reminderOptIn);
    const rawLeadMinutes = Number(rawBody?.reminderLeadMinutes);
    const reminderLeadMinutes = Number.isFinite(rawLeadMinutes)
      ? Math.min(Math.max(Math.floor(rawLeadMinutes), 5), 1440)
      : 60;

    const parsed = createFacilityBookingSchema.parse({
      ...rawBody,
      reminderOptIn,
      reminderLeadMinutes,
      startTime,
      endTime,
      userId: authResult.user.id,
      status: "pending",
    });

    if (parsed.clientRequestId) {
      const existingRequest = await storage.getFacilityBookingByClientRequestId(
        parsed.clientRequestId,
        authResult.user.id,
      );
      if (existingRequest) {
        return NextResponse.json(existingRequest, { status: 200 });
      }
    }

    const isAdminUser = authResult.userRecord?.role === 'admin';

    if (!isAdminUser) {
      const hoursValidation = validateLibraryHours(parsed.startTime, parsed.endTime);
      if (!hoursValidation.ok) return NextResponse.json(hoursValidation.error.body, { status: hoursValidation.error.status });

      const sameDayValidation = validateSameDay(parsed.startTime, parsed.endTime);
      if (!sameDayValidation.ok) return NextResponse.json(sameDayValidation.error.body, { status: sameDayValidation.error.status });
    }

    const facilityResult = await getFacilityOrError(parsed.facilityId);
    if (!facilityResult.ok) return NextResponse.json(facilityResult.error.body, { status: facilityResult.error.status });
    const facility = facilityResult.value;

    const facilityEligibility = await ensureFacilityIsBookable(
      authResult.user.id,
      facility,
      parsed.participants,
      parsed.startTime,
      parsed.endTime,
    );
    if (!facilityEligibility.ok) {
      return NextResponse.json(facilityEligibility.error.body, { status: facilityEligibility.error.status });
    }

    // Check facility-specific duration and daily booking limits
    const facilityName = facility.name.toLowerCase();
    const isCollabRoom = facilityName.includes('collaborative learning room 1') || facilityName.includes('collaborative learning room 2');

    if (isCollabRoom && !isAdminUser) {
      // Max 2 hours for collaborative learning rooms
      const durationMs = parsed.endTime.getTime() - parsed.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours > 2) {
        return NextResponse.json(
          { message: 'Collaborative Learning Rooms can only be booked for a maximum of 2 hours.' },
          { status: 400 }
        );
      }
    }

    // Global daily booking limit: max 2 bookings per user per day
    if (!isAdminUser) {
      const startOfDay = new Date(parsed.startTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsed.startTime);
      endOfDay.setHours(23, 59, 59, 999);

      // Force refresh bookings after possible cancellation
      let allUserBookings = await storage.getFacilityBookingsByUser(authResult.user.id);
      // Log bookings for debugging
      console.log('[Booking Debug] User bookings after cancellation:', allUserBookings.map((b: any) => ({ id: b.id, status: b.status, startTime: b.startTime, endTime: b.endTime })));


      // Filter only active bookings (approved or pending), ignore cancelled/denied
      allUserBookings = allUserBookings.filter((b: any) => b.status === 'approved' || b.status === 'pending');


      // Only count bookings that are not cancelled or denied
      const bookingsTodayCount = allUserBookings.filter((b: any) => {
        const bookingStart = new Date(b.startTime);
        return (b.status === 'approved' || b.status === 'pending') && bookingStart >= startOfDay && bookingStart <= endOfDay;
      }).length;

      console.log(`[Booking Debug] Bookings today count: ${bookingsTodayCount}`);
      if (bookingsTodayCount >= 2) {
        return NextResponse.json(
          { message: 'You have reached the maximum of 2 bookings per day. Please cancel an existing booking or try a different day.' },
          { status: 400 }
        );
      }
    }

    const conflictResult = await enforceUserBookingConflicts(
      authResult.user.id,
      parsed.startTime,
      parsed.endTime,
      forceCancelConflicts,
    );
    if (!conflictResult.ok) {
      return NextResponse.json(conflictResult.error.body, { status: conflictResult.error.status });
    }

    // Validate equipment availability (first-come, first-served)
    const requestedEquipment = parsed.equipment as any;
    if (requestedEquipment) {
      const requestedItems: string[] = Array.isArray(requestedEquipment?.items) ? requestedEquipment.items : [];
      if (requestedItems.length > 0) {
        const availability = await storage.getEquipmentAvailability(parsed.startTime, parsed.endTime);
        const unavailableItems: string[] = [];
        for (const item of requestedItems) {
          const key = String(item).toLowerCase().replace(/\s+/g, '_');
          const inv = availability.find(a => a.key === key);
          if (inv && (inv.totalCount - inv.bookedCount) <= 0) {
            unavailableItems.push(inv.label);
          }
        }
        if (unavailableItems.length > 0) {
          return NextResponse.json(
            { message: `The following equipment is no longer available for this time slot: ${unavailableItems.join(', ')}. Please unselect them and try again.` },
            { status: 409 }
          );
        }
      }
    }

    const equipment = parsed.equipment as { items?: unknown[]; others?: string | null } | undefined;
    const hasEquipmentRequest = Boolean(equipment?.items?.length || equipment?.others?.trim());
    const bookingInput = {
      ...parsed,
      equipmentRequestStatus: hasEquipmentRequest ? "pending" as const : null,
    };

    let booking = await storage
      .createFacilityBooking(bookingInput)
      .catch(async (error: any) => {
        if (error?.code === "23505" && parsed.clientRequestId) {
          const existingRequest = await storage.getFacilityBookingByClientRequestId(
            parsed.clientRequestId,
            authResult.user.id,
          );
          if (existingRequest) return existingRequest;
        }
        if (error?.name === "ConflictError") {
          try {
            const facilityInfo = await storage.getFacility(parsed.facilityId);
            const conflicts = (error.conflicts || []).map((conflict: any) => ({
              id: conflict.id,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              status: conflict.status,
              userId: conflict.userId,
            }));
            return Promise.reject(
              NextResponse.json(
                {
                  message: "This time slot for the selected facility is already booked. Please choose a different time.",
                  facility: { id: facilityInfo?.id, name: facilityInfo?.name },
                  conflictingBookings: conflicts,
                },
                { status: 409 }
              )
            );
          } catch (innerError) {
            return Promise.reject(
              NextResponse.json(
                {
                  message: "This time slot for the selected facility is already booked. Please choose a different time.",
                  conflictingBookings: error.conflicts || [],
                },
                { status: 409 }
              )
            );
          }
        }
        throw error;
      });

    if (booking instanceof NextResponse) {
      return booking;
    }

    await sendBookingNotifications({
      booking,
      facility,
      userId: authResult.user.id,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
    });

    const refreshed = await refreshBooking(booking.id);
    return NextResponse.json(refreshed ?? booking, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("[bookings] Failed to create booking:", error);
    const message = error instanceof Error ? error.message : "Failed to create booking";
    return NextResponse.json({ message }, { status: 400 });
  }
}
