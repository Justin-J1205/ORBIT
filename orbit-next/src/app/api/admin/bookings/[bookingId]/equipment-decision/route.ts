import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminUser } from "@/server/core";
import { storage } from "@/server/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const authResult = await requireAdminUser(request.headers);
  if (!authResult.ok) return authResult.response;

  try {
    const { bookingId } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ message: "Invalid equipment decision body." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const status = payload.status;
    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    if (status !== "approved" && status !== "denied") {
      return NextResponse.json({ message: "Equipment status must be approved or denied." }, { status: 400 });
    }
    if (status === "denied" && (reason.length < 5 || reason.length > 1000)) {
      return NextResponse.json({ message: "Enter a decline reason between 5 and 1000 characters." }, { status: 400 });
    }

    const booking = await storage.getFacilityBooking(bookingId);
    if (!booking) return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    if (!booking.equipment) return NextResponse.json({ message: "This booking has no equipment request." }, { status: 400 });
    if (booking.equipmentRequestStatus !== "pending") {
      return NextResponse.json({ message: "This equipment request has already been decided." }, { status: 409 });
    }

    const facility = await storage.getFacility(booking.facilityId);
    const facilityName = facility?.name ?? `Facility ${booking.facilityId}`;
    const action = status === "approved" ? "Equipment Request Approved" : "Equipment Request Declined";
    const details = `${action}: booking ${bookingId}, requester ${booking.userId}, program ${booking.program ?? "Not recorded"}; reason: ${reason || "approved by administrator"}.`;
    await storage.updateFacilityBookingWithActivity(
      bookingId,
      {
        equipmentRequestStatus: status,
        equipmentDeclineReason: status === "denied" ? reason : null,
        adminId: authResult.user.id,
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        userId: authResult.user.id,
        action,
        details,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
        createdAt: new Date(),
      },
      "pending",
    );

    try {
      await storage.createSystemAlert({
        id: randomUUID(),
        type: "user",
        severity: status === "denied" ? "medium" : "low",
        title: action,
        message: status === "approved"
          ? `Your equipment request for ${facilityName} has been approved.`
          : `Your equipment request for ${facilityName} was declined. Reason: ${reason}`,
        userId: booking.userId,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (notificationError) {
      console.error("[admin/bookings/equipment-decision] Decision saved but requester notification failed:", notificationError);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "ConflictError") {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[admin/bookings/equipment-decision] Failed to record equipment decision:", error);
    return NextResponse.json({ message: "Failed to record equipment decision." }, { status: 500 });
  }
}
