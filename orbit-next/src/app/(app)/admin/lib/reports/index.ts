import * as XLSX from 'xlsx';

export function generateBookingWeeklyReport(
  bookings: Array<any>,
  getFacilityName: (id: any) => string,
  getUserEmail: (id: any) => string
) {
  const bk = Array.isArray(bookings) ? bookings.slice() : [];

  const formatFacilityNameForReport = (name: string) => {
    if (!name) return name;
    const lower = name.toLowerCase();
    if (lower === 'lounge' && !lower.includes('faculty')) {
      return 'Faculty Lounge';
    }
    return name;
  };

  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  wsData.push(['Booking Weekly Report']);
  wsData.push([`Generated: ${new Date().toLocaleString()}`]);
  wsData.push([`Total Bookings: ${bk.length}`]);
  wsData.push([]);

  wsData.push(['Week', 'Date', 'Day', 'Time', 'Facility', 'Name', 'Program', 'User Email', 'Status', 'Participants', 'Purpose', 'Booking ID']);

  const getWeekKey = (isoDateStr: string) => {
    const d = new Date(isoDateStr);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const weekMap: Record<string, any[]> = {};
  for (const b of bk) {
    const dateIso = (() => { try { return new Date(b.startTime).toISOString(); } catch (_e) { return new Date().toISOString(); } })();
    const weekKey = getWeekKey(dateIso);
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(b);
  }

  const weekKeys = Object.keys(weekMap).sort().reverse();

  for (const wk of weekKeys) {
    const items = weekMap[wk].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    wsData.push([wk, '', '', '', '', '', '', '', '', '', '', '']);

    for (const booking of items) {
      const dateObj = new Date(booking.startTime);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
      const startTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTime = new Date(booking.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const timeStr = `${startTime} - ${endTime}`;
      const facilityName = formatFacilityNameForReport(getFacilityName(booking.facilityId));
      const name = booking.name || 'Not recorded';
      const program = booking.program || 'Not recorded';
      const userEmail = getUserEmail(booking.userId);

      const now = new Date();
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      let status = booking.status || 'N/A';

      if (booking.status === 'approved') {
        if (now >= bookingStart && now <= bookingEnd) {
          status = 'Active';
        } else if (now > bookingEnd) {
          status = 'Completed';
        } else if (now < bookingStart) {
          status = 'Scheduled';
        }
      } else if (booking.status === 'pending') {
        status = 'Pending';
      } else if (booking.status === 'denied') {
        status = 'Denied';
      } else if (booking.status === 'cancelled') {
        status = 'Cancelled';
      }

      const participants = booking.participants || 0;
      const purpose = (booking.purpose || 'N/A').substring(0, 200);
      const bookingId = booking.id || 'N/A';

      wsData.push(['', dateStr, dayName, timeStr, facilityName, name, program, userEmail, status, participants, purpose, bookingId]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 12 },
    { wch: 30 },
    { wch: 6 },
    { wch: 18 },
    { wch: 30 },
    { wch: 24 },
    { wch: 16 },
    { wch: 35 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
    { wch: 38 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Booking Report');
  XLSX.writeFile(wb, `booking-weekly-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
