/**
 * Booking Modal Hooks
 * 
 * Custom hooks for facility management, booking status, and form state
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Facility } from '@shared/schema';
import { isFacilityAllowedForRole } from '@shared/facilityAccess';
import { getPredefinedFacilities } from '../utils';

/**
 * Hook to fetch and filter facilities based on user role
 */
export function useFacilities(
  facilities: Facility[], 
  userRole?: string
) {
  // Use provided facilities or fallback to predefined
  const fallbackFacilities = getPredefinedFacilities();
  const allFacilities = useMemo(
    () => (facilities.length > 0 ? facilities : fallbackFacilities),
    [facilities]
  );

  // Filter facilities based on user role
  const visibleFacilities = useMemo(() => {
    return allFacilities.filter(
      (facility) => facility.isActive && isFacilityAllowedForRole(facility, userRole || "student"),
    );
  }, [allFacilities, userRole]);

  return {
    allFacilities,
    visibleFacilities,
  };
}

/**
 * Hook to fetch all bookings
 */
export function useAllBookings(isOpen: boolean) {
  const { data: allBookingsRaw } = useQuery<any[]>({
    queryKey: ["/api/bookings/all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/bookings/all");
      return response.json();
    },
    enabled: isOpen,
  });

  return useMemo(() => allBookingsRaw ?? [], [allBookingsRaw]);
}

/**
 * Hook to get facility capacity with fallback
 */
export function useGetFacilityMaxCapacity() {
  return useCallback((facility?: Facility | { id: number; name: string; isActive: boolean; capacity: number; } | null) => {
    if (!facility) return 8; // Default fallback
    const capacity = facility.capacity;
    return (typeof capacity === 'number' && capacity > 0) ? capacity : 8;
  }, []);
}

/**
 * Hook to get current facility status (active/upcoming bookings)
 */
export function useGetFacilityCurrentStatus(allBookings: any[]) {
  return useCallback((facilityId: number) => {
    const now = new Date();
    
    // Check for both pending and approved bookings
    const blockingStatuses = ["approved", "pending"];
    const facilityBookings = allBookings
      .filter((booking: any) => 
        booking.facilityId === facilityId && 
        blockingStatuses.includes(booking.status) &&
        new Date(booking.endTime) > now
      )
      .sort((a: any, b: any) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

    if (facilityBookings.length === 0) return null;

    // Check for currently active booking (only approved)
    const activeBooking = facilityBookings.find((booking: any) => {
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      return booking.status === "approved" && now >= start && now <= end;
    });

    if (activeBooking) {
      return {
        type: "active",
        message: `Currently in use until ${new Date(activeBooking.endTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`,
        booking: activeBooking
      };
    }

    // Check for upcoming bookings
    const upcomingBookings = facilityBookings.filter((booking: any) => 
      blockingStatuses.includes(booking.status) && new Date(booking.startTime) > now
    );

    if (upcomingBookings.length > 0) {
      return {
        type: "upcoming",
        message: `${upcomingBookings.length} upcoming booking${upcomingBookings.length > 1 ? 's' : ''}`,
        bookings: upcomingBookings
      };
    }

    return null;
  }, [allBookings]);
}
