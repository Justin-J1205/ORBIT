import { useState, useEffect } from 'react';

/**
 * Hook for managing booking modal state
 */
export function useBookingModalState() {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedFacilityForBooking, setSelectedFacilityForBooking] = useState<number | null>(null);
  const [initialStartForBooking, setInitialStartForBooking] = useState<Date | null>(null);
  const [initialEndForBooking, setInitialEndForBooking] = useState<Date | null>(null);
  const [initialTimesAreSuggested, setInitialTimesAreSuggested] = useState<boolean>(false);
  const [bookingToEdit, setBookingToEdit] = useState<any>(null);

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedFacilityForBooking(null);
    setInitialStartForBooking(null);
    setInitialEndForBooking(null);
    setBookingToEdit(null);
  };

  return {
    showBookingModal,
    setShowBookingModal,
    selectedFacilityForBooking,
    setSelectedFacilityForBooking,
    initialStartForBooking,
    setInitialStartForBooking,
    initialEndForBooking,
    setInitialEndForBooking,
    initialTimesAreSuggested,
    setInitialTimesAreSuggested,
    bookingToEdit,
    setBookingToEdit,
    closeBookingModal,
  };
}

/**
 * Hook for managing cancel booking modal state
 */
export function useCancelBookingModalState() {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);

  return {
    showCancelModal,
    setShowCancelModal,
    bookingToCancel,
    setBookingToCancel,
  };
}

/**
 * Hook for managing view state
 */
export function useViewState() {
  const [selectedView, setSelectedView] = useState("dashboard");
  const [scrollToBookingId, setScrollToBookingId] = useState<string | null>(null);
  const [openOthers, setOpenOthers] = useState<Record<string, boolean>>({});
  const [devForceOpen, setDevForceOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return {
    selectedView,
    setSelectedView,
    scrollToBookingId,
    setScrollToBookingId,
    openOthers,
    setOpenOthers,
    devForceOpen,
    setDevForceOpen,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
  };
}

/**
 * Hook for managing activity logs state
 */
export function useActivityState() {
  const [activityTab, setActivityTab] = useState<'booking' | 'notifications'>('booking');
  const [activityBookingPage, setActivityBookingPage] = useState(0);
  const [activityNotificationsPage, setActivityNotificationsPage] = useState(0);
  const [activitySearchTerm, setActivitySearchTerm] = useState('');

  return {
    activityTab,
    setActivityTab,
    activityBookingPage,
    setActivityBookingPage,
    activityNotificationsPage,
    setActivityNotificationsPage,
    activitySearchTerm,
    setActivitySearchTerm,
  };
}

/**
 * Hook for handling escape key to close mobile sidebar
 */
export function useEscapeKey(isMobileSidebarOpen: boolean, setIsMobileSidebarOpen: (value: boolean) => void) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileSidebarOpen, setIsMobileSidebarOpen]);
}
