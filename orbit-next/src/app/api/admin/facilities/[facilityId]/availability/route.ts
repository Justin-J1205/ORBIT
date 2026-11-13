import { NextResponse, type NextRequest } from "next/server";

import { requireAdminUser } from "@/server/core";
import { storage } from "@/server/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ facilityId: string }>;
};

function isYyyyMmDd(value: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { facilityId: idParam } = await context.params;
  const facilityId = Number(idParam);
  if (!idParam || !Number.isInteger(facilityId)) {
    return NextResponse.json({ message: "Invalid facility id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;
  const reason: string | undefined = body?.reason ? String(body.reason) : undefined;
  const startDate: string | undefined = body?.startDate ? String(body.startDate) : undefined;
  const endDate: string | undefined = body?.endDate ? String(body.endDate) : undefined;
  const clearUnavailable: boolean = body?.clearUnavailable === true;

  if (isActive === undefined) {
    return NextResponse.json({ message: "isActive must be provided" }, { status: 400 });
  }

  try {
    const facility = await storage.getFacility(facilityId);
    if (!facility) {
      return NextResponse.json({ message: "Facility not found" }, { status: 404 });
    }

    const updates: any = { isActive };
    if (typeof reason === "string" && reason.trim()) {
      updates.unavailableReason = reason.trim();
    }

    // If making unavailable and a date range is provided, append to unavailableDates
    if (isActive === false && startDate && endDate) {
      if (!isYyyyMmDd(startDate) || !isYyyyMmDd(endDate)) {
        return NextResponse.json({ message: "startDate and endDate must be YYYY-MM-DD" }, { status: 400 });
      }

      // Normalize existing array
      let existing: Array<{ startDate: string; endDate: string; reason?: string }> = [];
      const raw = (facility as any).unavailableDates;
      if (Array.isArray(raw)) {
        existing = raw.map((r: any) => ({
          startDate: String(r?.startDate ?? r?.start ?? ""),
          endDate: String(r?.endDate ?? r?.end ?? ""),
          reason: r?.reason ? String(r.reason) : undefined,
        })).filter((r) => r.startDate && r.endDate);
      }

      // Append if not duplicate
      const duplicate = existing.some((r) => r.startDate === startDate && r.endDate === endDate);
      if (!duplicate) {
        existing.push({ startDate, endDate, reason: updates.unavailableReason });
      }

      updates.unavailableDates = existing;
    }

    // If enabling and explicitly asked to clear, wipe unavailable ranges and reason
    if (isActive === true && clearUnavailable) {
      updates.unavailableDates = [];
      updates.unavailableReason = null;
    }
    // If enabling with a specific date range, remove any overlapping portions from ranges
    if (isActive === true && !clearUnavailable && startDate && endDate) {
      if (!isYyyyMmDd(startDate) || !isYyyyMmDd(endDate)) {
        return NextResponse.json({ message: "startDate and endDate must be YYYY-MM-DD" }, { status: 400 });
      }
      let existing: Array<{ startDate: string; endDate: string; reason?: string }> = [];
      const raw = (facility as any).unavailableDates;
      if (Array.isArray(raw)) {
        existing = raw.map((r: any) => ({
          startDate: String(r?.startDate ?? r?.start ?? ""),
          endDate: String(r?.endDate ?? r?.end ?? ""),
          reason: r?.reason ? String(r.reason) : undefined,
        })).filter((r) => r.startDate && r.endDate);
      }

      const toDate = (s: string) => new Date(`${s}T00:00:00`);
      const dayBefore = (s: string) => {
        const d = toDate(s); d.setDate(d.getDate() - 1); return d;
      };
      const dayAfter = (s: string) => {
        const d = toDate(s); d.setDate(d.getDate() + 1); return d;
      };
      const fmt = (d: Date) => {
        const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      const s = toDate(startDate);
      const e = toDate(endDate);

      const adjusted: Array<{ startDate: string; endDate: string; reason?: string }> = [];
      for (const r of existing) {
        const ra = toDate(r.startDate);
        const rb = toDate(r.endDate);
        // no overlap
        if (e < ra || s > rb) {
          adjusted.push(r);
          continue;
        }
        // full cover -> remove entirely
        if (s <= ra && e >= rb) {
          continue;
        }
        // removal in the middle -> split
        if (s > ra && e < rb) {
          adjusted.push({ startDate: r.startDate, endDate: fmt(dayBefore(startDate)), reason: r.reason });
          adjusted.push({ startDate: fmt(dayAfter(endDate)), endDate: r.endDate, reason: r.reason });
          continue;
        }
        // trim left
        if (s <= ra && e < rb) {
          adjusted.push({ startDate: fmt(dayAfter(endDate)), endDate: r.endDate, reason: r.reason });
          continue;
        }
        // trim right
        if (s > ra && e >= rb) {
          adjusted.push({ startDate: r.startDate, endDate: fmt(dayBefore(startDate)), reason: r.reason });
          continue;
        }
      }
      updates.unavailableDates = adjusted;
    }

    await storage.updateFacility(facilityId, updates);
    const updated = await storage.getFacility(facilityId);
    return NextResponse.json(updated ?? { success: true }, { status: 200 });
  } catch (error) {
    console.error(`[admin/facilities/${facilityId}/availability] Failed to update:`, error);
    return NextResponse.json({ message: "Failed to update facility availability" }, { status: 500 });
  }
}
