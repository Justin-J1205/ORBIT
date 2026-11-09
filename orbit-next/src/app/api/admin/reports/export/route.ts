import { NextResponse } from "next/server";

import { requireAdminUser } from "@/server/core";
import { storage } from "@/server/core";
import { buildAdminReportPDF } from "@/server/pdf/reportBuilder";

export const dynamic = "force-dynamic";

interface ExportRequestBody {
  reportType?: string;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function formatSummaryCount(label: string, value: number | string) {
  return [label, String(value ?? 0)];
}

export async function POST(req: Request) {
  const auth = await requireAdminUser(req.headers);
  if (!auth.ok) {
    return auth.response;
  }

  let body: ExportRequestBody = {};
  try {
    if (req.body) {
      body = await req.json();
    }
  } catch (_e) {
    body = {};
  }

  const reportType = (body.reportType || "booking-overview").toLowerCase();

  if (reportType !== "booking-overview") {
    return NextResponse.json({ error: `Unsupported report type: ${reportType}` }, { status: 400 });
  }

  const [bookings, facilities, users, reportSchedules] = await Promise.all([
    storage.getAllFacilityBookings(),
    storage.getAllFacilities(),
    storage.getAllUsers(),
    storage.getReportSchedules(),
  ]);

  const facilityNameById = new Map<number, string>();
  for (const facility of facilities) {
    facilityNameById.set(facility.id, facility.name || `Facility ${facility.id}`);
  }

  const userEmailById = new Map<string, string>();
  for (const user of users) {
    const fallbackName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    userEmailById.set(String(user.id), user.email || fallbackName || `User ${user.id}`);
  }

  const now = new Date();
  const upcoming = bookings
    .filter((booking) => new Date(booking.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 25);

  const recent = bookings
    .filter((booking) => new Date(booking.startTime) < now)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 25);

  const activeSchedules = reportSchedules.filter((s) => s.isActive !== false).length;

  const sections = [
    {
      title: "Summary",
      rows: [
        ["Metric", "Value"],
        formatSummaryCount("Total bookings", bookings.length),
        formatSummaryCount("Upcoming bookings (next 90 days)", upcoming.length),
        formatSummaryCount("Recent bookings exported", recent.length),
        formatSummaryCount("Managed facilities", facilities.length),
        formatSummaryCount("Registered users", users.length),
        formatSummaryCount("Active report schedules", activeSchedules),
      ],
      subtitle: "Automated snapshot of key ORBIT facility metrics."
    },
    {
      title: "Upcoming Bookings",
      subtitle: upcoming.length ? "Next 25 scheduled reservations" : "No upcoming bookings found.",
      rows: [
        ["When", "Facility", "Name", "Program", "User", "Status", "Participants"],
        ...upcoming.map((booking) => [
          formatDateTime(booking.startTime),
          facilityNameById.get(booking.facilityId) ?? String(booking.facilityId),
          booking.name || "Not recorded",
          booking.program || "Not recorded",
          userEmailById.get(String(booking.userId)) ?? String(booking.userId),
          booking.status || "—",
          String(booking.participants ?? 0),
        ]),
      ],
    },
    {
      title: "Recent Activity",
      subtitle: recent.length ? "Most recent 25 concluded or in-progress bookings" : "No recent bookings found.",
      rows: [
        ["When", "Facility", "Name", "Program", "User", "Status", "Purpose"],
        ...recent.map((booking) => [
          formatDateTime(booking.startTime),
          facilityNameById.get(booking.facilityId) ?? String(booking.facilityId),
          booking.name || "Not recorded",
          booking.program || "Not recorded",
          userEmailById.get(String(booking.userId)) ?? String(booking.userId),
          booking.status || "—",
          (booking.purpose || "—").slice(0, 80),
        ]),
      ],
    },
  ];

  const pdfBytes = await buildAdminReportPDF({
    title: "ORBIT Facility Booking Overview",
    generatedAt: new Date().toLocaleString(),
    sections,
    footer: "Generated via ORBIT Admin Dashboard • For internal use only",
  });

  const fileName = `orbit-booking-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdfBuffer = Buffer.from(pdfBytes);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
