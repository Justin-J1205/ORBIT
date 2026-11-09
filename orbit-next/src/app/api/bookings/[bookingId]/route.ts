import { randomUUID } from "crypto";

import { NextResponse, type NextRequest } from "next/server";

import { requireActiveUser } from "@/server/core";
import { storage } from "@/server/core";
import {
  isWithinLibraryHours,
  formatLibraryHours,
  validateSameDay,
  refreshBooking,
  getFacilityOrError,
  ensureFacilityIsBookable,
  setArrivalConfirmationDeadline,
} from "@/server/bookings/helpers";
import { db } from "@/server/config";
import { facilityBookings, insertFacilityBookingSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  const authResult = await requireActiveUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { bookingId } = await context.params;

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Invalid booking update body." }, { status: 400 });
    }
    const { purpose, startTime, endTime, facilityId, participants } = payload ?? {};

    const existingBooking = await storage.getFacilityBooking(bookingId);
    if (!existingBooking) {
      return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    }

    const requesterId = authResult.user.id;
    const requesterRecord = authResult.userRecord ?? (await storage.getUser(requesterId));
    const isAdmin = ["admin", "authorize_selga", "authorize_bonifacio"].includes(requesterRecord?.role ?? "");

    if (!isAdmin && String(existingBooking.userId) !== String(requesterId)) {
      return NextResponse.json({ message: "You are not allowed to update this booking." }, { status: 403 });
    }

    if (!isAdmin) {
      const isUpcomingBooking = existingBooking.status === "approved"
        && new Date(existingBooking.startTime) > new Date();
      if (existingBooking.status !== "pending" && !isUpcomingBooking) {
        return NextResponse.json({ message: "Only pending or upcoming bookings can be rescheduled." }, { status: 400 });
      }
      const protectedFields = ["status", "arrivalConfirmed", "arrivalConfirmationDeadline", "adminResponse"];
      if (protectedFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
        return NextResponse.json({ message: "You are not allowed to change administrative booking fields." }, { status: 403 });
      }
    }

    const adminOnlyFields = ["status", "arrivalConfirmed", "arrivalConfirmationDeadline", "adminResponse"];
    if (isAdmin && adminOnlyFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
      return NextResponse.json(
        { message: "Use the admin booking action endpoint to change booking status or arrival confirmation." },
        { status: 400 }
      );
    }

    const identityResult = insertFacilityBookingSchema
      .pick({ name: true, program: true })
      .safeParse(payload);
    if (!identityResult.success) {
      return NextResponse.json(
        { message: identityResult.error.issues[0]?.message ?? "A booking name and program are required." },
        { status: 400 }
      );
    }

    if (typeof purpose !== "string" || !purpose.trim() || purpose.length > 200 || !startTime || !endTime || facilityId === undefined || facilityId === null) {
      return NextResponse.json(
        { message: "A purpose of 1 to 200 characters, start time, end time, and facilityId are required." },
        { status: 400 }
      );
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);
    const isScheduleChange = parsedStartTime.getTime() !== new Date(existingBooking.startTime).getTime()
      || parsedEndTime.getTime() !== new Date(existingBooking.endTime).getTime()
      || Number(facilityId) !== existingBooking.facilityId;
    if (isAdmin && isScheduleChange) {
      return NextResponse.json(
        { message: "Use the admin booking management reschedule action so the reason and audit record are saved together." },
        { status: 400 }
      );
    }

    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime())) {
      return NextResponse.json({ message: "Invalid start or end time format." }, { status: 400 });
    }

    if (!isAdmin && parsedStartTime <= new Date()) {
      return NextResponse.json({ message: "Rescheduled bookings must start in the future." }, { status: 400 });
    }

    if (!isAdmin) {
      if (!isWithinLibraryHours(parsedStartTime)) {
        return NextResponse.json(
          { message: `Start time must be within school working hours (${formatLibraryHours()})` },
          { status: 400 }
        );
      }

      if (!isWithinLibraryHours(parsedEndTime)) {
        return NextResponse.json(
          { message: `End time must be within school working hours (${formatLibraryHours()})` },
          { status: 400 }
        );
      }

      const sameDayValidation = validateSameDay(parsedStartTime, parsedEndTime);
      if (!sameDayValidation.ok) {
        return NextResponse.json(sameDayValidation.error.body, { status: sameDayValidation.error.status });
      }
    }

    const bookingOwnerId = existingBooking.userId;
    const parsedFacilityId = Number(facilityId);

    if (!Number.isInteger(parsedFacilityId)) {
      return NextResponse.json({ message: "Invalid facility id." }, { status: 400 });
    }

    const parsedParticipants = Number(participants ?? existingBooking.participants);
    if (!Number.isInteger(parsedParticipants) || parsedParticipants < 1) {
      return NextResponse.json({ message: "Participants must be a positive whole number." }, { status: 400 });
    }

    const facilityResult = await getFacilityOrError(parsedFacilityId);
    if (!facilityResult.ok) {
      return NextResponse.json(facilityResult.error.body, { status: facilityResult.error.status });
    }
    const facility = facilityResult.value;
    const facilityEligibility = await ensureFacilityIsBookable(
      bookingOwnerId,
      facility,
      parsedParticipants,
      parsedStartTime,
      parsedEndTime,
    );
    if (!facilityEligibility.ok) {
      return NextResponse.json(facilityEligibility.error.body, { status: facilityEligibility.error.status });
    }

    // Check facility-specific duration and daily booking limits
    const facilityName = facility.name.toLowerCase();
    const isCollabRoom = facilityName.includes('collaborative learning room 1') || facilityName.includes('collaborative learning room 2');
      
    if (isCollabRoom && !isAdmin) {
        // Max 2 hours for collaborative learning rooms
        const durationMs = parsedEndTime.getTime() - parsedStartTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        
        if (durationHours > 2) {
          return NextResponse.json(
            { message: 'Collaborative Learning Rooms can only be booked for a maximum of 2 hours.' },
            { status: 400 }
          );
        }
        
        // Max 2 bookings per day for collaborative learning rooms
        // TEMPORARILY DISABLED FOR TESTING
        /*
        const startOfDay = new Date(parsedStartTime);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(parsedStartTime);
        endOfDay.setHours(23, 59, 59, 999);
        
        const allUserBookings = await storage.getFacilityBookingsByUser(bookingOwnerId);
        const existingBookingsToday = allUserBookings.filter((b: any) => {
          const bookingStart = new Date(b.startTime);
          return (
            b.facilityId === parsedFacilityId &&
            (b.status === 'approved' || b.status === 'pending') &&
            b.id !== bookingId &&
            bookingStart >= startOfDay &&
            bookingStart <= endOfDay
          );
        });
        
        if (existingBookingsToday.length >= 2) {
          return NextResponse.json(
            { message: 'You can only book this Collaborative Learning Room twice per day. You have reached your daily limit.' },
            { status: 400 }
          );
        }
        */
    }

    if (!isAdmin) {
      const overlappingBookings = await storage.checkUserOverlappingBookings(
        bookingOwnerId,
        parsedStartTime,
        parsedEndTime,
        bookingId
      );
      if (overlappingBookings.length > 0) {
        const conflict = overlappingBookings[0];
        return NextResponse.json(
          {
            message:
              "You already have another booking during this time period. Please choose a different time.",
            existingBooking: {
              id: conflict.id,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              facilityId: conflict.facilityId,
              status: conflict.status,
            },
          },
          { status: 409 }
        );
      }

      const facilityBookings = await storage.checkUserFacilityBookings(
        bookingOwnerId,
        parsedFacilityId,
        bookingId
      );
      if (facilityBookings.length > 0) {
        const conflict = facilityBookings[0];
        return NextResponse.json(
          {
            message:
              "You already have an active booking for this facility. Please cancel your existing booking first.",
            existingBooking: {
              id: conflict.id,
              startTime: conflict.startTime,
              endTime: conflict.endTime,
              facilityId: conflict.facilityId,
              status: conflict.status,
            },
          },
          { status: 409 }
        );
      }
    }

    if (!isAdmin) {
      const dayStart = new Date(parsedStartTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(parsedStartTime);
      dayEnd.setHours(23, 59, 59, 999);
      const bookingsToday = (await storage.getFacilityBookingsByUser(bookingOwnerId)).filter((booking: any) => {
        if (String(booking.id) === String(bookingId) || !["approved", "pending"].includes(booking.status)) return false;
        const bookingStart = new Date(booking.startTime);
        return bookingStart >= dayStart && bookingStart <= dayEnd;
      });
      if (bookingsToday.length >= 2) {
        return NextResponse.json({ message: "You have reached the maximum of 2 bookings per day." }, { status: 400 });
      }
    }

    const conflictingApproved = await storage.checkApprovedBookingConflicts(
      parsedFacilityId,
      parsedStartTime,
      parsedEndTime,
      bookingId
    );

    if (conflictingApproved.length > 0) {
      const facility = await storage.getFacility(parsedFacilityId);
      const conflicts = conflictingApproved.map((booking) => ({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      }));
      return NextResponse.json(
        {
          message: "This time slot for the selected facility is already booked. Please choose a different time.",
          facility: { id: parsedFacilityId, name: facility?.name ?? null },
          conflictingBookings: conflicts,
        },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      purpose,
      facilityId: parsedFacilityId,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      name: identityResult.data.name,
      program: identityResult.data.program,
      updatedAt: new Date(),
    };

    if (payload.status && ["pending", "approved", "denied", "cancelled"].includes(payload.status)) {
      updatePayload.status = payload.status;
    }

    if (payload.arrivalConfirmed !== undefined) {
      updatePayload.arrivalConfirmed = Boolean(payload.arrivalConfirmed);
    }

    if (payload.arrivalConfirmationDeadline) {
      const deadline = new Date(payload.arrivalConfirmationDeadline);
      if (!Number.isNaN(deadline.getTime())) {
        updatePayload.arrivalConfirmationDeadline = deadline;
      }
    }

    if (payload.adminResponse !== undefined) {
      updatePayload.adminResponse = String(payload.adminResponse);
    }

    try {
      const incomingEquipment = payload?.equipment;
      if (incomingEquipment) {
        const normalized = {
          items: Array.isArray(incomingEquipment.items)
            ? incomingEquipment.items.map((item: unknown) => String(item))
            : [],
          others: incomingEquipment.others ? String(incomingEquipment.others) : null,
        };
        updatePayload.equipment = normalized;
      }
    } catch (error) {
      console.warn("[bookings] Failed to normalize equipment", error);
    }

    updatePayload.participants = parsedParticipants;

    await storage.updateFacilityBooking(bookingId, updatePayload as any);

    if (
      !isAdmin
      && existingBooking.status === "approved"
      && parsedStartTime.getTime() !== new Date(existingBooking.startTime).getTime()
    ) {
      await setArrivalConfirmationDeadline(bookingId, parsedStartTime);
    }

    if (updatePayload.equipment) {
      try {
        await db.update(facilityBookings).set({ equipment: updatePayload.equipment as any }).where(eq(facilityBookings.id, bookingId));
        
        // Mark all old equipment-related notifications as read
        try {
          const alerts = await storage.getSystemAlerts();
          const equipmentAlerts = alerts.filter((alert: any) => 
            alert.userId === bookingOwnerId &&
            alert.title &&
            (alert.title.includes('Equipment') || alert.title.includes('Needs'))
          );
          
          for (const alert of equipmentAlerts) {
            await storage.updateSystemAlert(alert.id, { isRead: true } as any);
          }
        } catch (alertError) {
          console.warn("[bookings] Failed to mark equipment alerts as read", alertError);
        }

        // Create a new notification showing the updated equipment status
        try {
          const admin = await storage.getUser(authResult.user.id).catch(() => null);
          const user = await storage.getUser(bookingOwnerId).catch(() => null);
          const facility = await storage.getFacility(parsedFacilityId).catch(() => null);
          
          const adminEmail = admin?.email || 'Admin';
          const userEmail = user?.email || 'User';
          const facilityName = facility?.name || `Facility ${parsedFacilityId}`;
          
          // Build status message with inline equipment status
          const equipment = updatePayload.equipment as any;
          let statusParts: string[] = [];
          
          if (equipment.items && typeof equipment.items === 'object') {
            for (const [key, value] of Object.entries(equipment.items)) {
              const label = key.replace(/_/g, ' ');
              const status = String(value).toLowerCase();
              statusParts.push(`${label}: ${status}`);
            }
          }
          
          const statusText = statusParts.join(' • ');
          const userMessage = `${adminEmail} updated your equipment request for ${facilityName}. ${statusText}`;
          
          await storage.createSystemAlert({
            id: randomUUID(),
            type: "user",
            severity: "low",
            title: "Equipment or Needs Request",
            message: userMessage,
            userId: bookingOwnerId,
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (notifError) {
          console.warn("[bookings] Failed to create equipment update notification", notifError);
        }
      } catch (error) {
        console.warn("[bookings] Failed to persist equipment via db", error);
      }
    }

    try {
      const facility = await storage.getFacility(parsedFacilityId).catch(() => null);
      await storage.createActivityLog({
        id: randomUUID(),
        action: "Booking Updated",
        details: `Booking ${bookingId} for ${facility?.name || `Facility ${parsedFacilityId}`} updated to ${parsedStartTime.toLocaleString()} - ${parsedEndTime.toLocaleString()}`,
        userId: isAdmin ? requesterId : bookingOwnerId,
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent"),
        createdAt: new Date(),
      });
    } catch (logError) {
      console.warn("[bookings] Failed to log booking update", logError);
    }

    const refreshed = await refreshBooking(bookingId);
    return NextResponse.json(refreshed ?? updatePayload, { status: 200 });
  } catch (error) {
    console.error("[bookings] Failed to update booking:", error);
    return NextResponse.json({ message: "Failed to update booking." }, { status: 500 });
  }
}
