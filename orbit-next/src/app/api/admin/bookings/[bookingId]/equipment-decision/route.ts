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
    const status = payload.status === "denied" ? "declined" : payload.status;
    const itemKey = typeof payload.itemKey === "string" ? payload.itemKey.trim() : "";
    const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
    if (status !== "approved" && status !== "declined") {
      return NextResponse.json({ message: "Equipment status must be approved or declined." }, { status: 400 });
    }
    if (itemKey.length > 200) {
      return NextResponse.json({ message: "Equipment item key is too long." }, { status: 400 });
    }
    if (status === "declined" && (reason.length < 5 || reason.length > 1000)) {
      return NextResponse.json({ message: "Enter a decline reason between 5 and 1000 characters." }, { status: 400 });
    }

    const booking = await storage.getFacilityBooking(bookingId);
    if (!booking) return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    if (!booking.equipment) return NextResponse.json({ message: "This booking has no equipment request." }, { status: 400 });
    if (!itemKey && booking.equipmentRequestStatus !== "pending") {
      return NextResponse.json({ message: "This equipment request has already been decided." }, { status: 409 });
    }

    const facility = await storage.getFacility(booking.facilityId);
    const facilityName = facility?.name ?? `Facility ${booking.facilityId}`;
    const action = itemKey
      ? `Equipment Item ${status === "approved" ? "Approved" : "Declined"}`
      : `Equipment Request ${status === "approved" ? "Approved" : "Declined"}`;
    const details = `${action}: booking ${bookingId}${itemKey ? `, item ${itemKey}` : ""}, requester ${booking.userId}, program ${booking.program ?? "Not recorded"}; reason: ${reason || "approved by administrator"}.`;
    const activity = {
      id: randomUUID(),
      userId: authResult.user.id,
      action,
      details,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      createdAt: new Date(),
    };

    let updatedEquipmentStatus = status;
    if (itemKey) {
      const updatedBooking = await storage.updateFacilityBookingEquipmentItemDecision(
        bookingId,
        itemKey,
        status,
        reason,
        activity,
      );
      updatedEquipmentStatus = updatedBooking.equipmentRequestStatus ?? "pending";
    } else {
      await storage.updateFacilityBookingWithActivity(
        bookingId,
        {
          equipmentRequestStatus: status,
          equipmentDeclineReason: status === "declined" ? reason : null,
          adminId: authResult.user.id,
          updatedAt: new Date(),
        },
        activity,
        booking.status,
      );
    }

    try {
      await storage.createSystemAlert({
        id: randomUUID(),
        type: "user",
        severity: status === "declined" ? "medium" : "low",
        title: action,
        message: `${itemKey ? `The ${itemKey} item in` : "Your"} equipment request for ${facilityName} was ${status}.${reason ? ` Reason: ${reason}` : ""}`,
        userId: booking.userId,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (notificationError) {
      console.error("[admin/bookings/equipment-decision] Decision saved but requester notification failed:", notificationError);
    }

    return NextResponse.json({
      success: true,
      ...(itemKey ? { itemStatus: status, equipmentRequestStatus: updatedEquipmentStatus } : {}),
    }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "ConflictError") {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    console.error("[admin/bookings/equipment-decision] Failed to record equipment decision:", error);
    return NextResponse.json({ message: "Failed to record equipment decision." }, { status: 500 });
  }
}
