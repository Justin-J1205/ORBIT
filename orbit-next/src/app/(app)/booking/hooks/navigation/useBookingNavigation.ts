import { useEffect } from 'react';
import { useLegacyLocation } from "@/lib/utils";
import { DEFAULT_BOOKING_LEAD_TIME, DEFAULT_BOOKING_DURATION } from '../../config/constants';
import { apiRequest } from "@/lib/api";
import { pickAvailableSlot, findEarliestAvailableSlot, findSmartBookingSlot } from '../../lib/helpers/availabilityHelpers';
import { isFacilityAllowedForRole } from "@shared/facilityAccess";

/**
 * Hook for handling initial URL hash
 */
export function useInitialHashNavigation(
  setSelectedView: (view: string) => void,
  openBookingModal: (facilityId?: number, start?: Date, end?: Date) => void,
  setInitialStartForBooking: (date: Date | null) => void,
  setInitialEndForBooking: (date: Date | null) => void,
  setInitialTimesAreSuggested: (value: boolean) => void
) {
  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (hash) {
      if (hash === 'available-rooms') {
        setSelectedView('available-rooms');
      } else {
        setSelectedView(hash);
      }
    }

    if (hash === 'new') {
      const start = new Date(Date.now() + DEFAULT_BOOKING_LEAD_TIME);
      const end = new Date(start.getTime() + DEFAULT_BOOKING_DURATION);
      setInitialStartForBooking(start);
      setInitialEndForBooking(end);
      setInitialTimesAreSuggested(false);
      openBookingModal(undefined, start, end);
    }
  }, []);
}

/**
 * Hook for handling activity logs hash changes
 */
export function useActivityLogsHashNavigation(
  setSelectedView: (view: string) => void,
  setActivityTab: (tab: 'booking' | 'notifications') => void,
  setActivityBookingPage: (page: number) => void,
  setActivityNotificationsPage: (page: number) => void
) {
  useEffect(() => {
    try {
      const rawHash = window.location.hash?.replace('#', '') || '';
      if (!rawHash) return;
      const normalized = rawHash.replace('/', ':');
      const parts = normalized.split(':');
      if (parts[0] === 'activity-logs') {
        setSelectedView('activity-logs');
        if (parts[1] === 'notifications') {
          setActivityTab('notifications');
          setActivityNotificationsPage(0);
        } else if (parts[1] === 'booking') {
          setActivityTab('booking');
          setActivityBookingPage(0);
        }
      } else if (parts[0] === 'available-rooms') {
        setSelectedView('available-rooms');
      }
    } catch (e) {
      // ignore
    }
  }, []);
}

/**
 * Hook for consuming one-time notification flag
 */
export function useOpenNotificationsOnce(
  setSelectedView: (view: string) => void,
  setActivityTab: (tab: 'booking' | 'notifications') => void,
  setActivityNotificationsPage: (page: number) => void
) {
  useEffect(() => {
    try {
      const v = sessionStorage.getItem('openNotificationsOnce');
      if (!v) return;
      sessionStorage.removeItem('openNotificationsOnce');
      setSelectedView('activity-logs');
      setActivityTab('notifications');
      setActivityNotificationsPage(0);
      try { 
        window.history.replaceState({}, '', '/booking#activity-logs:notifications'); 
      } catch (_) {}
    } catch (e) {
      // ignore
    }
  }, []);
}

/**
 * Hook for consuming one-time available rooms flag
 */
export function useOpenAvailableRoomsOnce(setSelectedView: (view: string) => void) {
  useEffect(() => {
    try {
      const v = sessionStorage.getItem('openAvailableRoomsOnce');
      if (!v) return;
      sessionStorage.removeItem('openAvailableRoomsOnce');
      setSelectedView('available-rooms');
      try { 
        window.history.replaceState({}, '', '/booking#available-rooms'); 
      } catch (_) {}
    } catch (e) {
      // ignore
    }
  }, []);
}

/**
 * Hook for handling reload navigation normalization
 */
export function useReloadNormalization(setSelectedView: (view: string) => void) {
  useEffect(() => {
    const isReloadNavigation = () => {
      try {
        const navEntries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation') as PerformanceNavigationTiming[] : [];
        if (Array.isArray(navEntries) && navEntries[0] && (navEntries[0] as any).type) {
          return (navEntries[0] as any).type === 'reload' || (navEntries[0] as any).type === 'back_forward';
        }
        if ((performance as any).navigation && typeof (performance as any).navigation.type === 'number') {
          return (performance as any).navigation.type === 1;
        }
      } catch (e) {
        // ignore
      }
      return false;
    };

    try {
      const rawHash = window.location.hash?.replace('#', '') || '';
      if (!rawHash) return;
      const normalized = rawHash.replace('/', ':');
      const parts = normalized.split(':');
      
      if (parts[0] === 'activity-logs') {
        const notificationsFlag = sessionStorage.getItem('openNotificationsOnce');
        const availableRoomsFlag = sessionStorage.getItem('openAvailableRoomsOnce');
        
        if (!notificationsFlag && !availableRoomsFlag && isReloadNavigation()) {
          try {
            const target = '/booking#dashboard';
            if (window.location.pathname + window.location.hash !== target) {
              window.history.replaceState({}, '', target);
            }
          } catch (e) { /* ignore */ }
          setSelectedView('dashboard');
        }
      } else if (parts[0] === 'available-rooms') {
        const v = sessionStorage.getItem('openAvailableRoomsOnce');
        if (!v && isReloadNavigation()) {
          try {
            const target = '/booking#dashboard';
            if (window.location.pathname + window.location.hash !== target) {
              window.history.replaceState({}, '', target);
            }
          } catch (e) { /* ignore */ }
          setSelectedView('dashboard');
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);
}

/**
 * Hook for listening to hash changes
 */
export function useHashChangeListener(
  setSelectedView: (view: string) => void,
  setActivityTab: (tab: 'booking' | 'notifications') => void,
  setActivityBookingPage: (page: number) => void,
  setActivityNotificationsPage: (page: number) => void
) {
  useEffect(() => {
    const onHashChange = () => {
      try {
        const rawHash = window.location.hash?.replace('#', '') || '';
        if (!rawHash) return;
        const normalized = rawHash.replace('/', ':');
        const parts = normalized.split(':');
        if (parts[0] === 'activity-logs') {
          setSelectedView('activity-logs');
          if (parts[1] === 'notifications') {
            setActivityTab('notifications');
            setActivityNotificationsPage(0);
          } else if (parts[1] === 'booking') {
            setActivityTab('booking');
            setActivityBookingPage(0);
          }
        } else if (parts[0] === 'available-rooms') {
          setSelectedView('available-rooms');
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('hashchange', onHashChange);
    const onOpenAvailable = () => { 
      try { 
        setSelectedView('available-rooms'); 
      } catch (e) {} 
    };
    window.addEventListener('openAvailableRooms', onOpenAvailable as EventListener);
    
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('openAvailableRooms', onOpenAvailable as EventListener);
    };
  }, []);
}

/**
 * Hook for handling legacy /notifications route
 */
export function useLegacyNotificationsRoute(
  setSelectedView: (view: string) => void,
  setActivityTab: (tab: 'booking' | 'notifications') => void,
  setActivityNotificationsPage: (page: number) => void
) {
  const [location] = useLegacyLocation();
  
  useEffect(() => {
    try {
      if (location && location.startsWith('/notifications')) {
        setSelectedView('activity-logs');
        setActivityTab('notifications');
        setActivityNotificationsPage(0);
      }
    } catch (e) {
      // ignore
    }
  }, [location]);
}

/**
 * Hook for consuming one-time booking flag
 */
export function useOpenBookingOnce(
  setSelectedView: (view: string) => void,
  setScrollToBookingId: (id: string | null) => void,
  userBookings: any[],
  allBookings: any[]
) {
  useEffect(() => {
    const openBookingHandler = (idStr?: string) => {
      try {
        const id = idStr ? String(idStr) : sessionStorage.getItem('openBookingOnce');
        if (!id) return;
        try { 
          sessionStorage.removeItem('openBookingOnce'); 
        } catch (e) {}
        setSelectedView('my-bookings');
        setScrollToBookingId(String(id));
      } catch (e) {}
    };

    const onOpenBookingEvent = () => openBookingHandler();
    window.addEventListener('openBooking', onOpenBookingEvent as EventListener);

    try {
      const id = sessionStorage.getItem('openBookingOnce');
      if (id) openBookingHandler(id);
    } catch (e) {}

    return () => {
      window.removeEventListener('openBooking', onOpenBookingEvent as EventListener);
    };
  }, [userBookings, allBookings]);
}

/**
 * Create openBookingModal function with availability logic
 */
export function createOpenBookingModal(
  facilities: any[],
  availabilityMap: Map<number, any>,
  todayDateStr: string,
  user: any,
  toast: any,
  setSelectedFacilityForBooking: (id: number | null) => void,
  setInitialStartForBooking: (date: Date | null) => void,
  setInitialEndForBooking: (date: Date | null) => void,
  setShowBookingModal: (value: boolean) => void
) {
  return async (facilityId?: number, start?: Date, end?: Date) => {
    const facility = facilityId ? facilities.find((f) => f.id === facilityId) : undefined;
    if (facility && !isFacilityAllowedForRole(facility, user?.role || "student")) {
      toast({
        title: "Access Restricted",
        description: "Your account does not have permission to book this facility.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFacilityForBooking(facilityId || null);
    
    // Find available slot if no time provided
    if (!start) {
      const now = new Date();
      
      try {
        // Try smart slot from cached availability
        if (facilityId) {
          const entry = availabilityMap.get(facilityId);
          const smart = findSmartBookingSlot(entry, now);
          if (smart) {
            start = new Date(smart.start);
            end = new Date(smart.end);
          }
        }

        if (!start) {
          const earliestSlot = findEarliestAvailableSlot(availabilityMap, now);
          if (earliestSlot) {
            start = new Date(earliestSlot.start);
            end = new Date(earliestSlot.end);
          }
        }

        // Try fresh fetch for today if still no slot
        if (!start) {
          try {
            const resp = await apiRequest('GET', `/api/availability?date=${todayDateStr}`);
            const json = await resp.json();
            const dataArr = Array.isArray(json?.data) ? json.data : [];
            
            if (facilityId) {
              const entry = dataArr.find((d: any) => d.facility && d.facility.id === facilityId);
              const smart = findSmartBookingSlot(entry, now);
              if (smart) {
                start = new Date(smart.start);
                end = new Date(smart.end);
              }
            }
            
            if (!start) {
              const earliestSlot = findEarliestAvailableSlot(
                new Map(dataArr.map((d: any) => [d.facility.id, d])),
                now
              );
              if (earliestSlot) {
                start = new Date(earliestSlot.start);
                end = new Date(earliestSlot.end);
              }
            }
          } catch (e) {
            // ignore fetch errors
          }
        }

        // No slot today — try tomorrow
        if (!start) {
          try {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().slice(0, 10);
            const tomorrowStart = new Date(tomorrow);
            tomorrowStart.setHours(0, 0, 0, 0);

            const resp = await apiRequest('GET', `/api/availability?date=${tomorrowStr}`);
            const json = await resp.json();
            const dataArr = Array.isArray(json?.data) ? json.data : [];

            if (facilityId) {
              const entry = dataArr.find((d: any) => d.facility && d.facility.id === facilityId);
              const smart = findSmartBookingSlot(entry, tomorrowStart);
              if (smart) {
                start = new Date(smart.start);
                end = new Date(smart.end);
              }
            }

            if (!start) {
              const earliestSlot = findEarliestAvailableSlot(
                new Map(dataArr.map((d: any) => [d.facility.id, d])),
                tomorrowStart
              );
              if (earliestSlot) {
                start = new Date(earliestSlot.start);
                end = new Date(earliestSlot.end);
              }
            }
          } catch (e) {
            // ignore fetch errors
          }
        }
      } catch (e) {
        // fallback to default
      }

      // Final fallback
      if (!start) {
        start = new Date(Date.now() + DEFAULT_BOOKING_LEAD_TIME);
        end = new Date(start.getTime() + DEFAULT_BOOKING_DURATION);
      }
    }

    setInitialStartForBooking(start ?? null);
    setInitialEndForBooking(end ?? null);
    setShowBookingModal(true);
  };
}
