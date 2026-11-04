/**
 * Booking Validation Utilities
 * 
 * Functions for validating booking forms and formatting error messages
 */

import { format } from 'date-fns';
import {
  BOOKING_MIN_DURATION_MS,
  BOOKING_MAX_DURATION_MS,
  BOOKING_MIN_DURATION_MINUTES,
  BOOKING_MAX_DURATION_MINUTES,
} from '@shared/bookingRules';
import { isWithinLibraryHours, formatLibraryHours } from './dateTimeUtils';

export interface ValidationError {
  title: string;
  description: string;
}

export interface BookingValidationData {
  startTime?: Date;
  endTime?: Date;
  facilityId?: string;
  purpose?: string;
  participants?: number;
  allBookings?: any[];
  existingBookingId?: number | string;
  isAdmin?: boolean;
}

/**
 * Validate booking form data in real-time
 */
export function validateBookingForm(
  data: BookingValidationData,
  facilities: any[],
  userEmail?: string
): ValidationError[] {
  const validationErrors: ValidationError[] = [];

  // Only validate if we have the necessary data
  if (!data.startTime || !data.endTime || !data.facilityId) {
    return validationErrors;
  }

  // Validate start time is not in the past
  const currentTime = new Date();
  if (data.startTime.getTime() < currentTime.getTime()) {
    validationErrors.push({
      title: 'Invalid Start Time',
      description: 'Start time cannot be in the past. Please select a future time.',
    });
  }

  // Validate facility exists
  if (typeof data.facilityId !== 'string') {
    return validationErrors;
  }

  const facility = facilities.find((f) => f.id === parseInt(data.facilityId!, 10));
  if (!facility) {
    validationErrors.push({
      title: 'Invalid Facility',
      description: 'The selected facility is not available. Please choose another facility.',
    });
  } else if (!facility.isActive) {
    validationErrors.push({
      title: 'Facility Unavailable',
      description: `${facility.name} is currently unavailable. Please select a different facility.`,
    });
  }

  // Validate end time is after start time
  if (data.endTime <= data.startTime) {
    validationErrors.push({
      title: 'Invalid Time Selection',
      description: 'Invalid time selection. The start time must be earlier than the end time.',
    });
  }

  // Validate same calendar day (no multi-day bookings) — admin may skip
  if (!data.isAdmin) {
    const sDate = data.startTime;
    const eDate = data.endTime;
    if (
      sDate.getFullYear() !== eDate.getFullYear() ||
      sDate.getMonth() !== eDate.getMonth() ||
      sDate.getDate() !== eDate.getDate()
    ) {
      validationErrors.push({
        title: 'Single-Day Booking Required',
        description: 'Bookings must start and end on the same calendar day. Please split multi-day events into separate bookings.',
      });
    }
  }

  // Validate library hours for both start and end time — admin may skip
  if (!data.isAdmin) {
    const startTimeValid = isWithinLibraryHours(data.startTime);
    const endTimeValid = isWithinLibraryHours(data.endTime);

    if (!startTimeValid || !endTimeValid) {
      const timeIssues: string[] = [];
      if (!startTimeValid) timeIssues.push('start time');
      if (!endTimeValid) timeIssues.push('end time');
      validationErrors.push({
        title: 'Outside School Hours',
        description: `Your ${timeIssues.join(' and ')} ${timeIssues.length > 1 ? 'are' : 'is'} outside school operating hours (${formatLibraryHours()}). Room access is only available during these hours.`,
      });
    }
  }

  // Facility-specific duration validation
  if (facility && data.startTime && data.endTime) {
    const diff = data.endTime.getTime() - data.startTime.getTime();
    const durationMinutes = diff / (1000 * 60);
    const durationHours = diff / (1000 * 60 * 60);

    // Minimum duration check
    if (diff > 0 && diff < BOOKING_MIN_DURATION_MS) {
      validationErrors.push({
        title: 'Booking Too Short',
        description: `Bookings must be at least ${BOOKING_MIN_DURATION_MINUTES} minutes long. Your current booking is ${Math.floor(durationMinutes)} minutes.`,
      });
    }

    const facilityName = facility.name.toLowerCase();
    const isCollabRoom =
      facilityName.includes('collaborative learning room 1') ||
      facilityName.includes('collaborative learning room 2');

    if (isCollabRoom && durationHours > 2 && !data.isAdmin) {
      validationErrors.push({
        title: 'Duration Limit Exceeded',
        description: `Collaborative Learning Rooms can only be booked for a maximum of 2 hours. Your current booking is ${durationHours.toFixed(1)} hours. Please reduce your booking duration.`,
      });
    } else if (!isCollabRoom && diff > BOOKING_MAX_DURATION_MS && !data.isAdmin) {
      validationErrors.push({
        title: 'Maximum Duration Exceeded',
        description: `Bookings cannot exceed ${BOOKING_MAX_DURATION_MINUTES} minutes (${BOOKING_MAX_DURATION_MINUTES / 60} hours). Your current booking is ${Math.floor(durationMinutes)} minutes.`,
      });
    }

    // Capacity validation
    if (data.participants && data.participants > (facility.capacity || 8)) {
      validationErrors.push({
        title: 'Capacity Exceeded',
        description: `The selected room has a maximum capacity of ${facility.capacity || 8} people. Please reduce the number of participants to ${facility.capacity || 8} or fewer.`,
      });
    }
  }

  // Validate purpose field
  if (data.purpose !== undefined && data.purpose.trim().length === 0) {
    validationErrors.push({
      title: 'Purpose Required',
      description: 'Please provide a purpose for your booking.',
    });
  }

  // Validate no booking conflicts (same facility, overlapping time)
  console.log('[Validation] Before conflict check:', {
    hasAllBookings: !!data.allBookings,
    allBookingsLength: data.allBookings?.length,
    hasFacilityId: !!data.facilityId,
    facilityId: data.facilityId,
    hasStartTime: !!data.startTime,
    hasEndTime: !!data.endTime,
  });
  
  if (!data.isAdmin && data.allBookings && data.facilityId && data.startTime && data.endTime) {
    const facilityIdNum = parseInt(data.facilityId, 10);
    console.log('[Validation] Checking conflicts:', {
      facilityId: facilityIdNum,
      startTime: data.startTime,
      endTime: data.endTime,
      totalBookings: data.allBookings.length,
    });
    const conflictingBookings = data.allBookings.filter((booking: any) => {
      // Skip the current booking if editing
      if (data.existingBookingId && String(booking.id) === String(data.existingBookingId)) {
        return false;
      }

      // Extract facilityId - handle both object and number formats
      const bookingFacilityId = typeof booking.facilityId === 'object' 
        ? booking.facilityId?.id 
        : booking.facilityId;

      // Only check bookings for the same facility
      if (bookingFacilityId !== facilityIdNum) {
        return false;
      }

      // Only check approved bookings
      if (booking.status !== 'approved') {
        return false;
      }

      // Check for time overlap
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(booking.endTime);
      
      const overlaps = data.startTime! < bookingEnd && data.endTime! > bookingStart;
      console.log('[Validation] Checking booking:', {
        bookingId: booking.id,
        bookingFacilityId: typeof booking.facilityId === 'object' ? booking.facilityId?.id : booking.facilityId,
        requestedFacilityId: facilityIdNum,
        status: booking.status,
        bookingTime: `${bookingStart.toLocaleTimeString()} - ${bookingEnd.toLocaleTimeString()}`,
        requestedTime: `${data.startTime!.toLocaleTimeString()} - ${data.endTime!.toLocaleTimeString()}`,
        overlaps,
      });
      
      // Two bookings overlap if:
      // new start < existing end AND new end > existing start
      return overlaps;
    });

    console.log('[Validation] Conflicts found:', conflictingBookings.length);
    
    if (conflictingBookings.length > 0) {
      const conflictBooking = conflictingBookings[0];
      const conflictStart = new Date(conflictBooking.startTime);
      const conflictEnd = new Date(conflictBooking.endTime);
      
      console.log('[Validation] Adding conflict error:', {
        conflictBooking: conflictBooking.id,
        time: `${format(conflictStart, 'h:mm a')} to ${format(conflictEnd, 'h:mm a')}`,
      });
      
      validationErrors.push({
        title: 'Booking Conflict',
        description: `You already have a booking for this facility from ${format(conflictStart, 'h:mm a')} to ${format(conflictEnd, 'h:mm a')}. Please cancel your existing booking or choose a different time slot.`,
      });
    }
  }

  // Daily booking limit: max 2 active/pending bookings per day — admin may skip
  if (!data.isAdmin && data.allBookings && data.startTime) {
    const tgtDate = data.startTime;
    const todayCount = data.allBookings.filter((b: any) => {
      if (b.status === 'cancelled' || b.status === 'denied') return false;
      if (data.existingBookingId && String(b.id) === String(data.existingBookingId)) return false;
      const bStart = new Date(b.startTime);
      return (
        bStart.getFullYear() === tgtDate.getFullYear() &&
        bStart.getMonth() === tgtDate.getMonth() &&
        bStart.getDate() === tgtDate.getDate()
      );
    }).length;
    if (todayCount >= 2) {
      validationErrors.push({
        title: 'Daily Booking Limit Reached',
        description: 'You have reached the maximum of 2 bookings per day. Please cancel an existing booking first or choose a different day.',
      });
    }
  }

  return validationErrors;
}

/**
 * Format booking conflict error messages
 */
export function formatBookingConflictMessage(errorMessage: string): string {
  try {
    // Extract readable part before JSON
    const readablePart = errorMessage.split('. Existing booking:')[0];

    // Try to extract datetime info
    if (errorMessage.includes('Existing booking:') && errorMessage.includes('/')) {
      const dateTimeMatch = errorMessage.match(/(\d{1,2}\/\d{1,2}\/\d{4}[^"]*)/);
      if (dateTimeMatch) {
        return `${readablePart}. Your existing booking: ${dateTimeMatch[1]}`;
      }
    }

    // Clean up message
    const cleanMessage = readablePart
      .replace(/\s*\{\".*$/g, '')
      .replace(/\s*Please cancel your existing booking first.*$/g, '')
      .trim();

    return `${cleanMessage}. Please cancel your existing booking first or choose a different time.`;
  } catch (error) {
    return errorMessage
      .split('{"')[0]
      .replace(/ID:[^,\s]*/g, '')
      .trim();
  }
}

/**
 * Calculate booking duration
 */
export function calculateDuration(start?: Date, end?: Date): string {
  if (!start || !end) return '';
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return '';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

/**
 * Check if booking duration is valid
 */
export function isDurationValid(start?: Date, end?: Date): boolean {
  if (!start || !end) return false;
  const diff = end.getTime() - start.getTime();
  return diff >= BOOKING_MIN_DURATION_MS && diff <= BOOKING_MAX_DURATION_MS;
}
