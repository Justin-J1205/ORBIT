import { format } from 'date-fns';
import { LIBRARY_OPEN_TIME, LIBRARY_CLOSE_TIME } from '../../config/constants';

/**
 * Get the current booking status for a facility
 */
export function getFacilityBookingStatus(
  facilityId: number,
  facilities: any[],
  allBookings: any[],
  userBookings: any[],
  devForceOpen: boolean = false
) {
  const now = new Date();
  
  // Check if current time is within library working hours
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  let isWithinLibraryHours = currentTimeInMinutes >= LIBRARY_OPEN_TIME && currentTimeInMinutes <= LIBRARY_CLOSE_TIME;
  if (process.env.NODE_ENV !== 'production' && devForceOpen) {
    isWithinLibraryHours = true;
  }
  
  // Merge and deduplicate bookings
  const mergedBookings = [...allBookings, ...userBookings];
  const seen = new Set<string | number>();
  const deduped = [] as any[];
  for (const b of mergedBookings) {
    if (b && b.id != null && !seen.has(b.id)) {
      seen.add(b.id);
      deduped.push(b);
    }
  }

  // Filter bookings for this facility
  const facilityBookings = deduped.filter(booking => 
    booking.facilityId === facilityId &&
    (booking.status === "approved" || booking.status === "pending") &&
    new Date(booking.endTime) > now
  );

  // Check if facility is inactive
  const facility = facilities.find((f) => f.id === facilityId);
  if (facility && facility.isActive === false) {
    return {
      status: "unavailable",
      label: "Unavailable",
      booking: null,
      badgeClass: "bg-red-100 text-red-800"
    };
  }

  // Check if facility is currently booked
  const currentBooking = facilityBookings.find(booking => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return now >= start && now <= end && booking.status === "approved";
  });

  if (currentBooking) {
    return {
      status: "booked",
      label: "Currently Booked",
      booking: currentBooking,
      badgeClass: "bg-red-100 text-red-800"
    };
  }

  // Check if outside library hours
  if (!isWithinLibraryHours) {
    return {
      status: "closed",
      label: "School Closed",
      booking: null,
      badgeClass: "bg-gray-100 text-gray-800"
    };
  }

  // Check for pending booking (approved but user hasn't confirmed arrival yet)
  const pendingArrival = facilityBookings.find(booking => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return now >= start && now <= end && booking.status === "pending";
  });

  if (pendingArrival) {
    return {
      status: "pending",
      label: "Pending",
      booking: pendingArrival,
      badgeClass: "bg-amber-100 text-amber-800"
    };
  }

  return {
    status: "available",
    label: "Available",
    booking: null,
    badgeClass: "bg-green-100 text-green-800"
  };
}

/**
 * Get the display label and styling for a booking status
 */
/**
 * Get booking display status based on database status and time
 * 
 * IMPORTANT: Database statuses are: pending, approved, denied, cancelled
 * This function returns DISPLAY LABELS for the UI:
 * - "Scheduled" = approved booking that hasn't started (status='approved' + startTime > now)
 * - "Active" = approved booking currently in progress (status='approved' + start <= now <= end)
 * - "Completed" = approved booking that has ended (status='approved' + endTime < now)
 * - "Denied" = booking was denied by admin (status='denied')
 * - "Cancelled" = booking was cancelled (status='cancelled')
 * - "Pending" = waiting for approval (status='pending')
 * 
 * Never use "scheduled", "active", or "completed" as database status values!
 */
export function getBookingStatus(booking: any): { label: string; badgeClass: string } {
  const now = new Date();
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  
  if (booking.status === "denied") return { label: "Denied", badgeClass: "denied" };
  if (booking.status === "cancelled") return { label: "Cancelled", badgeClass: "cancelled" };
  if (booking.status === "pending") return { label: "Pending", badgeClass: "bg-blue-100 text-blue-800" };
  
  if (booking.status === "approved") {
    if (now < start) return { label: "Scheduled", badgeClass: "bg-yellow-100 text-yellow-800" };
    if (now >= start && now <= end) return { label: "Active", badgeClass: "active" };
    if (now > end) return { label: "Completed", badgeClass: "bg-gray-100 text-gray-800" };
  }
  
  return { label: booking.status, badgeClass: booking.status };
}

/**
 * Calculate booking statistics
 */
export function getStats(userBookings: any[]) {
  const now = new Date();

  const active = userBookings.filter((b) => {
    if (b.status !== "approved") return false;
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    return now >= start && now <= end;
  }).length;

  const upcoming = userBookings.filter((b) => {
    if (b.status !== "approved") return false;
    const start = new Date(b.startTime);
    return start > now;
  }).length;

  const pending = userBookings.filter((b) => b.status === "pending").length;

  return { active, upcoming, pending };
}

/**
 * Check if library is currently closed
 */
export function isLibraryClosedNow(devForceOpen: boolean = false): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  if (process.env.NODE_ENV !== 'production' && devForceOpen) return false;
  return currentTimeInMinutes < LIBRARY_OPEN_TIME || currentTimeInMinutes > LIBRARY_CLOSE_TIME;
}

/**
 * Get facility display name with campus
 */
export function getFacilityDisplay(facilityId: number, facilities: any[], campuses?: any[]): string {
  const facility = facilities.find((f) => f.id === facilityId);
  if (!facility) return `Facility ${facilityId}`;
  let name = facility.name || `Facility ${facilityId}`;
  
  const lower = name.toLowerCase();
  if (lower === 'lounge' && !lower.includes('faculty')) {
    name = 'Faculty Lounge';
  }

  const campusName = campuses?.find((c: any) => c.id === facility.campusId)?.name;
  return campusName ? `${campusName} | ${name}` : name;
}

/**
 * Check if facility is restricted (faculty-only)
 */
export function isRestrictedFacility(facility?: any): boolean {
  if (!facility) return false;
  const name = String(facility.name || '').toLowerCase();
  return name.includes('board room') || name.includes('boardroom') || name.includes('lounge');
}

/**
 * Format facility name for display
 */
export function formatFacilityName(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  if (lower === 'lounge' && !lower.includes('faculty')) {
    return 'Faculty Lounge';
  }
  return name;
}

/**
 * Get facility description by name
 */
export function getFacilityDescriptionByName(name?: string): string {
  if (!name) return '';
  const lower = name.toLowerCase();
  
  if (lower.includes('collaborative learning room 1')) {
    return 'Quiet study space with 4 tables';
  }
  if (lower.includes('collaborative learning room 2')) {
    return 'Computer lab with workstations';
  }
  if (lower.includes('board room') || lower.includes('boardroom')) {
    return 'Conference room for group meetings';
  }
  if (lower.includes('lounge')) {
    return 'Comfortable lounge area for informal study and relaxation.';
  }
  return 'Comfortable study space for individual or small group use.';
}

/**
 * Get facility image by name
 */
export function getFacilityImageByName(name?: string): string {
  if (!name) return '/images/facility-overview.jpg';
  const lower = name.toLowerCase();
  
  if (
    lower.includes('collab 1') ||
    lower.includes('collab1') ||
    lower.includes('collaboration 1') ||
    lower.includes('collaborative learning room 1')
  ) return '/images/collab1.jpg';
  
  if (
    lower.includes('collab 2') ||
    lower.includes('collab2') ||
    lower.includes('collaboration 2') ||
    lower.includes('collaborative learning room 2')
  ) return '/images/collab2.jpg';
  
  if (lower.includes('board room') || lower.includes('boardroom')) return '/images/boardroom.jpg';
  if (lower.includes('lounge')) return '/images/lounge.jpg';
  
  return '/images/facility-overview.jpg';
}

/**
 * Parse equipment data from notification message
 */
export function parseEquipmentFromMessage(message: string) {
  const equipmentMarker = message.indexOf('[Equipment:');
  if (equipmentMarker !== -1) {
    try {
      const baseMessage = message.substring(0, equipmentMarker).trim();
      
      const jsonStart = message.indexOf('{', equipmentMarker);
      if (jsonStart === -1) {
        return { baseMessage, equipment: null };
      }
      
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < message.length; i++) {
        if (message[i] === '{') depth++;
        if (message[i] === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }
      
      if (jsonEnd !== -1) {
        const jsonStr = message.substring(jsonStart, jsonEnd);
        const equipmentData = JSON.parse(jsonStr);
        return { baseMessage, equipment: equipmentData.items || equipmentData || {} };
      }
      
      return { baseMessage, equipment: null };
    } catch (e) {
      const baseMessage = message.substring(0, equipmentMarker).trim();
      return { baseMessage, equipment: null };
    }
  }
  return { baseMessage: message, equipment: null };
}

/**
 * Get color class for equipment status
 */
export function getEquipmentStatusColor(status: string): string {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  if (normalized === 'prepared' || normalized === 'available') {
    return 'bg-green-100 text-green-800';
  } else if (normalized === 'not available') {
    return 'bg-red-100 text-red-800';
  }
  return 'bg-gray-100 text-gray-800';
}

/**
 * Check if booking can be cancelled
 */
export function canCancelBooking(booking: any): boolean {
  if (!booking) return false;
  try {
    const now = new Date();
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    
    if (booking.status === 'pending') return true;
    if (booking.status === 'approved' && start > now && end > now) return true;
    return false;
  } catch (e) {
    return false;
  }
}
