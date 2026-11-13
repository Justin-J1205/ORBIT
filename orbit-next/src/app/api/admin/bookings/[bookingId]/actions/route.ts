import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminUser } from "@/server/core";
import { storage } from "@/server/core";
import { ensureFacilityIsBookable, validateSameDay } from "@/server/bookings/helpers";
import { facilityBookings, insertFacilityBookingSchema } from "@shared/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_REQUIRED_ACTIONS = new Set(["decline", "cancel", "reschedule", "modify", "force_active"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const authResult = await requireAdminUser(request.headers);
  if (!authResult.ok) return authResult.response;

  const { bookingId } = await params;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid booking action body." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const action = payload.action;
    if (typeof action !== "string" || !["approve", "decline", "cancel", "reschedule", "modify", "force_active"].includes(action)) {
      return NextResponse.json({ message: "Unsupported booking action." }, { status: 400 });
    }

    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    if (REASON_REQUIRED_ACTIONS.has(action) && (reason.length < 5 || reason.length > 1000)) {
      return NextResponse.json({ message: "Enter a reason between 5 and 1000 characters." }, { status: 400 });
    }

    const booking = await storage.getFacilityBooking(bookingId);
    if (!booking) return NextResponse.json({ message: "Booking not found." }, { status: 404 });

    const now = new Date();
    const updates: Partial<typeof facilityBookings.$inferSelect> = { adminId: authResult.user.id, updatedAt: now };
    let actionLabel = "";
    let notificationTitle = "";
    let notificationMessage = "";

    if (action === "approve") {
      if (booking.status !== "pending") {
        return NextResponse.json({ message: "Only pending bookings can be approved." }, { status: 409 });
      }
      if (new Date(booking.startTime) <= now) {
        return NextResponse.json({ message: "Bookings that have already started cannot be approved." }, { status: 400 });
      }
      updates.status = "approved";
      updates.arrivalConfirmed = false;
      updates.arrivalConfirmationDeadline = new Date(new Date(booking.startTime).getTime() + 15 * 60 * 1000);
      actionLabel = "Booking Approved";
      notificationTitle = "Booking Approved";
      notificationMessage = `Your booking for ${await getFacilityName(booking.facilityId)} has been approved.`;
    } else if (action === "decline") {
      if (booking.status !== "pending") {
        return NextResponse.json({ message: "Only pending bookings can be declined." }, { status: 409 });
      }
      updates.status = "denied";
      updates.declineReason = reason;
      updates.adminResponse = reason;
      actionLabel = "Booking Declined";
      notificationTitle = "Booking Request Declined";
      notificationMessage = `Your booking request for ${await getFacilityName(booking.facilityId)} was declined. Reason: ${reason}`;
    } else if (action === "cancel") {
      if (!["pending", "approved"].includes(booking.status)) {
        return NextResponse.json({ message: "This booking can no longer be cancelled." }, { status: 409 });
      }
      updates.status = "cancelled";
      updates.cancellationReason = reason;
      updates.adminResponse = reason;
      actionLabel = "Booking Cancelled by Admin";
      notificationTitle = "Booking Cancelled by Admin";
      notificationMessage = `Your booking for ${await getFacilityName(booking.facilityId)} was cancelled by an administrator. Reason: ${reason}`;
    } else if (action === "force_active") {
      if (!["pending", "approved"].includes(booking.status)) {
        return NextResponse.json({ message: "Only pending or approved bookings can be force-started." }, { status: 409 });
      }
      const startTime = payload.startTime === undefined ? now : new Date(String(payload.startTime));
      const endTime = payload.endTime === undefined ? new Date(now.getTime() + 2 * 60 * 60 * 1000) : new Date(String(payload.endTime));
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
        return NextResponse.json({ message: "Invalid booking time range." }, { status: 400 });
      }
      updates.status = "approved";
      updates.startTime = startTime;
      updates.endTime = endTime;
      updates.forceStartReason = reason;
      updates.arrivalConfirmed = false;
      updates.arrivalConfirmationDeadline = new Date(now.getTime() + 15 * 60 * 1000);
      actionLabel = "Booking Force Started by Admin";
      notificationTitle = actionLabel;
      notificationMessage = `An administrator force-started your booking for ${await getFacilityName(booking.facilityId)}. Reason: ${reason}`;
    } else {
      const currentStart = new Date(booking.startTime);
      if (!["pending", "approved"].includes(booking.status) || currentStart <= now) {
        return NextResponse.json({ message: "Only pending or upcoming bookings can be modified or rescheduled." }, { status: 409 });
      }

      const startTime = payload.startTime === undefined ? currentStart : new Date(String(payload.startTime));
      const endTime = payload.endTime === undefined ? new Date(booking.endTime) : new Date(String(payload.endTime));
      const facilityId = payload.facilityId === undefined ? booking.facilityId : Number(payload.facilityId);
      const participants = payload.participants === undefined ? booking.participants : Number(payload.participants);
      const purpose = payload.purpose === undefined ? booking.purpose : String(payload.purpose).trim();
      const requestedName = payload.name === undefined ? "" : String(payload.name).trim();
      const name = requestedName || booking.name;
      const requestedProgram = payload.program === undefined ? "" : String(payload.program);
      const program = requestedProgram || booking.program;
      const validProgram = program === null
        ? { success: true as const }
        : insertFacilityBookingSchema.pick({ program: true }).safeParse({ program });

      if (
        Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) ||
        startTime <= now || endTime <= startTime ||
        !Number.isInteger(facilityId) || !Number.isInteger(participants) || participants < 1 ||
        !purpose || purpose.length > 200 ||
        (name !== null && (typeof name !== "string" || name.length > 200)) ||
        !validProgram.success
      ) {
        return NextResponse.json({ message: "Enter valid future booking details before saving." }, { status: 400 });
      }

      const sameDay = validateSameDay(startTime, endTime);
      if (!sameDay.ok) return NextResponse.json(sameDay.error.body, { status: sameDay.error.status });

      const facility = await storage.getFacility(facilityId);
      if (!facility) return NextResponse.json({ message: "Facility not found." }, { status: 404 });
      const eligibility = await ensureFacilityIsBookable(
        facility,
        participants,
        startTime,
        endTime,
        { isAdmin: true },
      );
      if (!eligibility.ok) return NextResponse.json(eligibility.error.body, { status: eligibility.error.status });

      updates.facilityId = facilityId;
      updates.startTime = startTime;
      updates.endTime = endTime;
      updates.participants = participants;
      updates.purpose = purpose;
      updates.name = name;
      updates.program = program;
      updates.rescheduleReason = reason;
      if (booking.status === "approved") {
        updates.arrivalConfirmed = false;
        updates.arrivalConfirmationDeadline = new Date(startTime.getTime() + 15 * 60 * 1000);
      }
      actionLabel = action === "reschedule" ? "Booking Rescheduled" : "Booking Modified";
      notificationTitle = actionLabel;
      notificationMessage = `An administrator ${action === "reschedule" ? "rescheduled" : "modified"} your booking for ${facility.name}. Reason: ${reason}`;
    }

    const facilityName = await getFacilityName(updates.facilityId ?? booking.facilityId);
    const activityDetails = `${actionLabel}: booking ${bookingId} for ${facilityName}; requester ${booking.userId}; reason: ${reason || "approved by administrator"}.`;
    await storage.updateFacilityBookingWithActivity(bookingId, updates, {
      id: randomUUID(),
      userId: authResult.user.id,
      action: actionLabel,
      details: activityDetails,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      createdAt: now,
    }, booking.status);

    try {
      await storage.createSystemAlert({
        id: randomUUID(),
        type: "booking",
        severity: action === "approve" ? "low" : "medium",
        title: notificationTitle,
        message: notificationMessage,
        userId: booking.userId,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      });
    } catch (notificationError) {
      console.error("[admin/bookings/actions] Booking action saved but requester notification failed:", notificationError);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "ConflictError") {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[admin/bookings/actions] Failed to apply booking action:", error);
    return NextResponse.json({ message: "Failed to apply booking action." }, { status: 500 });
  }
}

async function getFacilityName(facilityId: number): Promise<string> {
  const facility = await storage.getFacility(facilityId);
  return facility?.name ?? `Facility ${facilityId}`;
}
