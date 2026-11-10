import { useEffect, useMemo, useState } from "react";
import { FacilityBooking } from "@shared/schema";
import { getTimestamp } from "@admin";

export function useBookingLists(
  allBookings: FacilityBooking[],
  pendingBookingsData: unknown,
  filterByFacility: (bookings: FacilityBooking[]) => FacilityBooking[],
  compareFacility: (a: FacilityBooking, b: FacilityBooking) => number
) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const activeBookings: FacilityBooking[] = useMemo(() => {
    const base = allBookings.filter(b => b.status === 'approved' && getTimestamp(b.startTime) <= currentTime && getTimestamp(b.endTime) >= currentTime);
    const filtered = filterByFacility(base);
    return filtered.slice().sort((a, b) => {
      const facilityComparison = compareFacility(a, b);
      if (facilityComparison !== 0) return facilityComparison;
      return getTimestamp(a.startTime) - getTimestamp(b.startTime);
    });
  }, [allBookings, currentTime, filterByFacility, compareFacility]);

  const upcomingBookings: FacilityBooking[] = useMemo(() => {
    const futureApproved = allBookings.filter(b => b.status === 'approved' && getTimestamp(b.startTime) > currentTime);
    const pending = Array.isArray(pendingBookingsData) ? pendingBookingsData : [];
    const uniqueBookings = new Map<string, FacilityBooking>();
    for (const booking of [...futureApproved, ...pending] as FacilityBooking[]) {
      if (booking?.id !== undefined && booking?.id !== null) {
        uniqueBookings.set(String(booking.id), booking);
      }
    }
    const merged = Array.from(uniqueBookings.values());
    const filtered = filterByFacility(merged);
    return filtered.slice().sort((a, b) => {
      const facilityComparison = compareFacility(a, b);
      if (facilityComparison !== 0) return facilityComparison;
      return getTimestamp(a.startTime) - getTimestamp(b.startTime);
    });
  }, [allBookings, currentTime, pendingBookingsData, filterByFacility, compareFacility]);

  const recentBookings: FacilityBooking[] = useMemo(() => {
    const base = allBookings.filter(b => {
      if (b.status === 'denied') return true;
      if (b.status === 'cancelled' || b.status === 'canceled' || b.status === 'expired' || b.status === 'void') return true;
      if (b.status === 'approved') {
        return getTimestamp(b.endTime) < currentTime;
      }
      return false;
    });
    const filtered = filterByFacility(base);
    return filtered.slice().sort((a, b) => {
      const facilityComparison = compareFacility(a, b);
      if (facilityComparison !== 0) return facilityComparison;
      return getTimestamp(b.createdAt || b.startTime) - getTimestamp(a.createdAt || a.startTime);
    });
  }, [allBookings, currentTime, filterByFacility, compareFacility]);

  const pendingBookings: FacilityBooking[] = useMemo(() => {
    const base = Array.isArray(pendingBookingsData) ? pendingBookingsData : [];
    const filtered = filterByFacility(base as FacilityBooking[]);
    return filtered.slice().sort((a, b) => {
      const facilityComparison = compareFacility(a, b);
      if (facilityComparison !== 0) return facilityComparison;
      return getTimestamp(a.startTime) - getTimestamp(b.startTime);
    });
  }, [pendingBookingsData, filterByFacility, compareFacility]);

  // Deduplicate scheduled bookings count: union of upcoming (approved future + pending API) and any pending items
  const scheduledCount = useMemo(() => {
    return new Set([...upcomingBookings, ...pendingBookings].map((booking) => String(booking.id))).size;
  }, [upcomingBookings, pendingBookings]);

  return {
    activeBookings,
    upcomingBookings,
    recentBookings,
    pendingBookings,
    scheduledCount,
  };
}
