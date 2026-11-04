import { randomUUID } from "crypto";

import { NextResponse, type NextRequest } from "next/server";

import { requireActiveUser } from "@/server/core";
import { storage } from "@/server/core";
import { isBuildTime } from "@/server/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> },
) {
  if (isBuildTime()) {
    return NextResponse.json({ success: false, build: true }, { status: 200 });
  }

  const authResult = await requireActiveUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { bookingId } = await context.params;
  
  // Check if this is an auto-cancellation due to arrival timeout
  const { searchParams } = new URL(request.url);
  const reason = searchParams.get('reason');
  const isArrivalTimeout = reason === 'arrival_timeout';

  try {
    const booking = await storage.getFacilityBooking(bookingId);

    if (!booking) {
      return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    }

    // Check if user is admin
    const requesterId = authResult.user.id;
    const requesterRecord = authResult.userRecord ?? (await storage.getUser(requesterId));
    const isAdmin = requesterRecord?.role === "admin";

    // Allow admin or booking owner to cancel
    if (!isAdmin && String(booking.userId) !== String(authResult.user.id)) {
      return NextResponse.json({ message: "You are not allowed to cancel this booking." }, { status: 403 });
    }

    const now = new Date();
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const isActiveApproved = booking.status === "approved" && start <= now && now <= end;
    const isUpcomingApproved = booking.status === "approved" && start > now && end > now;
    const arrivalDeadline = booking.arrivalConfirmationDeadline
      ? new Date(booking.arrivalConfirmationDeadline)
      : null;
    const canAutoCancelForArrivalTimeout = isArrivalTimeout
      && booking.status === "approved"
      && !booking.arrivalConfirmed
      && arrivalDeadline !== null
      && !Number.isNaN(arrivalDeadline.getTime())
      && arrivalDeadline <= now;
    const canCancel = booking.status === "pending" || isUpcomingApproved || canAutoCancelForArrivalTimeout;

    if (!canCancel) {
      return NextResponse.json(
        { message: "Only pending or upcoming bookings can be cancelled." },
        { status: 400 }
      );
    }

    await storage.updateFacilityBooking(bookingId, {
      status: "cancelled",
      updatedAt: new Date(),
    });

    try {
      const user = await storage.getUser(booking.userId).catch(() => null);
      const facility = await storage.getFacility(booking.facilityId).catch(() => null);
      const facilityName = facility?.name || `Facility ${booking.facilityId}`;
      const now = new Date();
      const cancelDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const bookingDate = start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      if (booking.status === "approved" && (isActiveApproved || isUpcomingApproved)) {
        const alertTitle = isActiveApproved ? "Booking Ended" : "Booking Cancelled";
        const verb = isActiveApproved ? "ended" : "cancelled";
        await storage.createSystemAlert({
          id: randomUUID(),
          type: "booking",
          severity: "low",
          title: alertTitle,
          message: `${user?.email || `User ${booking.userId}`} ${verb} their booking for ${facilityName} (${start.toLocaleString()} - ${end.toLocaleString()}).`,
          userId: null,
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      
      // Add user notification for auto-cancellation due to arrival timeout
      if (isArrivalTimeout) {
        await storage.createSystemAlert({
          id: randomUUID(),
          type: "booking",
          severity: "medium",
          title: "Booking Auto-Cancelled",
          message: `Your booking for ${facilityName} was automatically cancelled because you did not confirm your arrival within the required time (${start.toLocaleString()} - ${end.toLocaleString()}).`,
          userId: booking.userId,
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });
      } else if (isAdmin && String(booking.userId) !== String(requesterId)) {
        // Admin cancelled someone else's booking - notify the booking owner
        await storage.createSystemAlert({
          id: randomUUID(),
          type: "booking",
          severity: "medium",
          title: "Booking Cancelled by Admin",
          message: `Your booking for ${facilityName} booked on ${bookingDate} was cancelled by an administrator on ${cancelDate}.`,
          userId: booking.userId,
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        // User cancelled their own booking
        await storage.createSystemAlert({
          id: randomUUID(),
          type: "booking",
          severity: "low",
          title: "Booking Cancelled",
          message: `You cancelled your booking for ${facilityName} booked on ${bookingDate}, cancelled on ${cancelDate}.`,
          userId: booking.userId,
          isRead: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.warn("[bookings] Failed to create cancellation alert", error);
    }

    try {
      const facility = await storage.getFacility(booking.facilityId).catch(() => null);
      const wasActive = start <= new Date() && new Date() <= end;
      
      // Determine action type based on cancellation reason
      let action = "Booking Cancelled";
      let details = `User cancelled booking for ${facility?.name || `Facility ${booking.facilityId}`} (${start.toLocaleString()} - ${end.toLocaleString()})`;
      
      if (isArrivalTimeout) {
        action = "Booking Auto-Cancelled";
        details = `Booking for ${facility?.name || `Facility ${booking.facilityId}`} was automatically cancelled due to arrival confirmation timeout (${start.toLocaleString()} - ${end.toLocaleString()})`;
      } else if (wasActive) {
        action = "Booking Ended";
        details = `User ended booking for ${facility?.name || `Facility ${booking.facilityId}`} (${start.toLocaleString()} - ${end.toLocaleString()})`;
      }
      
      await storage.createActivityLog({
        id: randomUUID(),
        action,
        details,
        userId: booking.userId,
        ipAddress: null,
        userAgent: request.headers.get("user-agent") ?? null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.warn("[bookings] Failed to log cancellation", error);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[bookings] Failed to cancel booking:", error);
    return NextResponse.json({ message: "Failed to cancel booking." }, { status: 500 });
  }
}
