"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/data";
import { useToast } from "@/hooks/ui";
import { Header, Sidebar } from "@/components/layout";
import BookingModal from "@/components/modals/booking/BookingModal";
import { format } from 'date-fns';
import { useLegacyLocation } from "@/lib/utils";

// Import config
import {
  ITEMS_PER_PAGE,
  NOTIFICATIONS_PER_PAGE,
  BOOKINGS_PER_PAGE,
  generateSidebarItems,
  createSidebarClickHandler,
} from '../../config';

// Import hooks
import {
  // State hooks
  useBookingModalState,
  useCancelBookingModalState,
  useViewState,
  useActivityState,
  useEscapeKey,
  // Data hooks
  useFacilities,
  useAvailability,
  useUserBookings,
  useAllBookings,
  useNotifications,
  // Mutation hooks
  useCancelBooking,
  useMarkNotificationRead,
  // Navigation hooks
  useInitialHashNavigation,
  useActivityLogsHashNavigation,
  useOpenNotificationsOnce,
  useOpenAvailableRoomsOnce,
  useReloadNormalization,
  useHashChangeListener,
  useLegacyNotificationsRoute,
  useOpenBookingOnce,
  createOpenBookingModal,
} from '../../hooks';

// Import lib helpers
import {
  getFacilityBookingStatus,
  getBookingStatus,
  getStats,
  isLibraryClosedNow,
  getFacilityDisplay,
  isRestrictedFacility,
  formatFacilityName,
  getFacilityDescriptionByName,
  getFacilityImageByName,
  parseEquipmentFromMessage,
  getEquipmentStatusColor,
  canCancelBooking,
  buildUnavailableDatesByFacility,
  generateMockForFacilities,
  createActivityTabChangeHandler,
  createActivitySearchChangeHandler,
  createNavigateToBookingDetailsHandler,
  createMarkNotificationReadHandler,
  createCancelBookingHandler,
  createConfirmCancelBookingHandler,
  createCancelCancelBookingHandler,
  createViewAllBookingHistoryHandler,
  createArrivalCountdownExpireHandler,
  createActiveCountdownExpireHandler,
  useScrollToBookingEffect,
} from '../../lib';

// Import components
import { ContentRenderer } from './ContentRenderer';
import { LoadingSkeleton } from '../layout/LoadingSkeleton';
import { CancellationModal } from '../modals/CancellationModal';

export function BookingDashboardInner() {
  // Core hooks
  const { user, isLoading: authLoading, requiresPasswordSetup } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, setLocation] = useLegacyLocation();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (requiresPasswordSetup) {
      setLocation("/create-password");
    }
  }, [authLoading, user, requiresPasswordSetup, setLocation]);
  
  // State management
  const bookingModalState = useBookingModalState();
  const cancelBookingModalState = useCancelBookingModalState();
  const viewState = useViewState();
  const activityState = useActivityState();
  
  // Keyboard handling
  useEscapeKey(viewState.isMobileSidebarOpen, viewState.setIsMobileSidebarOpen);
  
  // Data fetching
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const { data: facilities = [], isLoading: isFacilitiesLoading, isFetching: isFacilitiesFetching } = useFacilities();
  const { data: campuses = [] } = useQuery<any[]>({
    queryKey: ["/api/campuses"],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/api");
      const res = await apiRequest("GET", "/api/campuses");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: availabilityDataRaw } = useAvailability(todayDateStr, user, authLoading);
  const { data: userBookingsData = [], isLoading: isUserBookingsLoading, isFetching: isUserBookingsFetching } = useUserBookings(user, authLoading);
  const { data: allBookingsData = [] } = useAllBookings(user, authLoading);
  const { data: notificationsData = [], isLoading: isNotificationsLoading, isFetching: isNotificationsFetching } = useNotifications(user, authLoading);
  
  // Mutations
  const cancelBookingMutation = useCancelBooking(toast);
  const markNotificationReadMutation = useMarkNotificationRead();
  
  // Data processing
  const userBookings = Array.isArray(userBookingsData) ? userBookingsData : [];
  const allBookings = Array.isArray(allBookingsData) ? allBookingsData : [];
  
  const unavailableDatesByFacility = useMemo(
    () => buildUnavailableDatesByFacility(facilities),
    [facilities]
  );
  
  const availabilityMap = (availabilityDataRaw && availabilityDataRaw.data && availabilityDataRaw.data.length > 0)
    ? new Map<number, any>((availabilityDataRaw.data || []).map((d: any) => [d.facility.id, d]))
    : generateMockForFacilities(facilities || []);
  
  const stats = getStats(userBookings);
  
  // Sidebar configuration
  const sidebarItems = generateSidebarItems(user);
  
  // Create handler functions with proper closures
  const openNewBookingModal = createOpenBookingModal(
    facilities,
    availabilityMap,
    todayDateStr,
    user,
    toast,
    bookingModalState.setSelectedFacilityForBooking,
    bookingModalState.setInitialStartForBooking,
    bookingModalState.setInitialEndForBooking,
    bookingModalState.setShowBookingModal
  );
  const openBookingModal = async (facilityId?: number, start?: Date, end?: Date) => {
    bookingModalState.setBookingToEdit(null);
    await openNewBookingModal(facilityId, start, end);
  };
  const handleRescheduleBooking = (booking: any) => {
    bookingModalState.setBookingToEdit(booking);
    bookingModalState.setSelectedFacilityForBooking(Number(booking.facilityId));
    bookingModalState.setInitialStartForBooking(new Date(booking.startTime));
    bookingModalState.setInitialEndForBooking(new Date(booking.endTime));
    bookingModalState.setShowBookingModal(true);
  };
  
  const handleSidebarClick = createSidebarClickHandler(
    setLocation,
    openBookingModal,
    viewState.setSelectedView,
    viewState.setIsMobileSidebarOpen
  );
  
  const handleActivityTabChange = createActivityTabChangeHandler(activityState.setActivityTab);
  
  const handleActivitySearchChange = createActivitySearchChangeHandler(
    activityState.setActivitySearchTerm,
    activityState.setActivityBookingPage,
    activityState.setActivityNotificationsPage
  );
  
  const handleNavigateToBookingDetails = createNavigateToBookingDetailsHandler(
    viewState.setSelectedView,
    viewState.setScrollToBookingId
  );
  
  const handleMarkNotificationRead = createMarkNotificationReadHandler(markNotificationReadMutation);
  
  const handleCancelBooking = createCancelBookingHandler(
    cancelBookingModalState.setBookingToCancel,
    cancelBookingModalState.setShowCancelModal
  );
  
  const confirmCancelBooking = createConfirmCancelBookingHandler(
    cancelBookingModalState.bookingToCancel,
    cancelBookingMutation,
    (id) => getFacilityDisplay(id, facilities, campuses),
    toast,
    cancelBookingModalState.setShowCancelModal,
    cancelBookingModalState.setBookingToCancel
  );
  
  const cancelCancelBooking = createCancelCancelBookingHandler(
    cancelBookingModalState.setShowCancelModal,
    cancelBookingModalState.setBookingToCancel
  );
  
  const handleViewAllBookingHistory = createViewAllBookingHistoryHandler(
    viewState.setSelectedView,
    activityState.setActivityTab
  );
  
  const handleArrivalCountdownExpire = createArrivalCountdownExpireHandler(
    queryClient,
    (id) => getFacilityDisplay(id, facilities, campuses),
    toast
  );
  
  const handleActiveCountdownExpire = createActiveCountdownExpireHandler(
    queryClient,
    (id) => getFacilityDisplay(id, facilities, campuses),
    toast
  );
  
  // Navigation effects
  useInitialHashNavigation(
    viewState.setSelectedView,
    openBookingModal,
    bookingModalState.setInitialStartForBooking,
    bookingModalState.setInitialEndForBooking,
    bookingModalState.setInitialTimesAreSuggested
  );
  
  useActivityLogsHashNavigation(
    viewState.setSelectedView,
    activityState.setActivityTab,
    activityState.setActivityBookingPage,
    activityState.setActivityNotificationsPage
  );
  
  useOpenNotificationsOnce(
    viewState.setSelectedView,
    activityState.setActivityTab,
    activityState.setActivityNotificationsPage
  );
  
  useOpenAvailableRoomsOnce(viewState.setSelectedView);
  
  useReloadNormalization(viewState.setSelectedView);
  
  useHashChangeListener(
    viewState.setSelectedView,
    activityState.setActivityTab,
    activityState.setActivityBookingPage,
    activityState.setActivityNotificationsPage
  );
  
  useLegacyNotificationsRoute(
    viewState.setSelectedView,
    activityState.setActivityTab,
    activityState.setActivityNotificationsPage
  );
  
  useOpenBookingOnce(
    viewState.setSelectedView,
    viewState.setScrollToBookingId,
    userBookings,
    allBookings
  );
  
  // Scroll effect
  useEffect(() => {
    return useScrollToBookingEffect(
      viewState.scrollToBookingId,
      viewState.selectedView,
      viewState.setScrollToBookingId
    );
  }, [viewState.scrollToBookingId, viewState.selectedView]);
  
  // Check if initial loading
  const isInitialLoading = (isFacilitiesLoading && facilities.length === 0) || 
                          (isUserBookingsLoading && userBookings.length === 0);

  if (!user || requiresPasswordSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Redirecting...
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header onMobileToggle={() => viewState.setIsMobileSidebarOpen(!viewState.isMobileSidebarOpen)} />
        <LoadingSkeleton
          sidebarItems={sidebarItems}
          selectedView={viewState.selectedView}
          handleSidebarClick={handleSidebarClick}
          isMobileSidebarOpen={viewState.isMobileSidebarOpen}
          setIsMobileSidebarOpen={viewState.setIsMobileSidebarOpen}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onMobileToggle={() => viewState.setIsMobileSidebarOpen(!viewState.isMobileSidebarOpen)} />
      
      {viewState.isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 top-16"
          onClick={() => viewState.setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 relative">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 h-[calc(100vh-4rem)] border-r bg-card fixed top-16 left-0 z-30 overflow-y-auto">
          <Sidebar
            items={sidebarItems}
            activeItem={viewState.selectedView}
            onItemClick={handleSidebarClick}
          />
        </div>

        {/* Mobile Sidebar */}
        <div
          className={`lg:hidden fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-card border-r z-40 overflow-y-auto transition-transform duration-300 ease-in-out ${
            viewState.isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            items={sidebarItems}
            activeItem={viewState.selectedView}
            onItemClick={handleSidebarClick}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-64 ml-0 w-full overflow-x-hidden">
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <ContentRenderer
            selectedView={viewState.selectedView}
            user={user}
            currentUserEmail={user?.email ?? undefined}            currentUserName={
              user
                ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || undefined
                : undefined
            }            userBookings={userBookings}
            facilities={facilities}
            isUserBookingsLoading={isUserBookingsLoading}
            isUserBookingsFetching={isUserBookingsFetching}
            itemsPerPage={ITEMS_PER_PAGE}
            openBookingModal={openBookingModal}
            onRescheduleBooking={handleRescheduleBooking}
            getBookingStatus={getBookingStatus}
            getFacilityDisplay={(id) => getFacilityDisplay(id, facilities, campuses)}
            openOthers={viewState.openOthers}
            setOpenOthers={viewState.setOpenOthers}
            onViewAllBookingHistory={handleViewAllBookingHistory}
            canCancelBooking={canCancelBooking}
            onCancelBooking={handleCancelBooking}
            cancelBookingMutationStatus={cancelBookingMutation.status}
            onArrivalCountdownExpire={handleArrivalCountdownExpire}
            onActiveCountdownExpire={handleActiveCountdownExpire}
            scrollToBookingId={viewState.scrollToBookingId}
            onResetScrollHighlight={() => viewState.setScrollToBookingId(null)}
            activityTab={activityState.activityTab}
            onActivityTabChange={handleActivityTabChange}
            activitySearchTerm={activityState.activitySearchTerm}
            onSearchTermChange={handleActivitySearchChange}
            activityBookingPage={activityState.activityBookingPage}
            activityNotificationsPage={activityState.activityNotificationsPage}
            setActivityNotificationsPage={activityState.setActivityNotificationsPage}
            bookingsPerPage={BOOKINGS_PER_PAGE}
            notificationsPerPage={NOTIFICATIONS_PER_PAGE}
            notificationsData={notificationsData}
            isNotificationsLoading={isNotificationsLoading}
            isNotificationsFetching={isNotificationsFetching}
            parseEquipmentFromMessage={parseEquipmentFromMessage}
            getEquipmentStatusColor={getEquipmentStatusColor}
            onNavigateToBookingDetails={handleNavigateToBookingDetails}
            onMarkNotificationRead={handleMarkNotificationRead}
            markNotificationReadPending={markNotificationReadMutation.isPending}
            isFacilitiesLoading={isFacilitiesLoading}
            isFacilitiesFetching={isFacilitiesFetching}
            availabilityMap={availabilityMap}
            unavailableDatesByFacility={unavailableDatesByFacility}
            getFacilityBookingStatus={(id) => getFacilityBookingStatus(id, facilities, allBookings, userBookings, viewState.devForceOpen)}
            getFacilityDescriptionByName={getFacilityDescriptionByName}
            getFacilityImageByName={getFacilityImageByName}
            formatFacilityName={formatFacilityName}
            isRestrictedFacility={isRestrictedFacility}
            isLibraryClosedNow={() => isLibraryClosedNow(viewState.devForceOpen)}
            devForceOpen={viewState.devForceOpen}
            setDevForceOpen={viewState.setDevForceOpen}
            setSelectedFacilityForBooking={bookingModalState.setSelectedFacilityForBooking}
            setInitialStartForBooking={bookingModalState.setInitialStartForBooking}
            setInitialEndForBooking={bookingModalState.setInitialEndForBooking}
            setInitialTimesAreSuggested={bookingModalState.setInitialTimesAreSuggested}
            toast={toast}
            stats={stats}
            setSelectedView={viewState.setSelectedView}
            setActivityTab={activityState.setActivityTab}
            setActivityBookingPage={activityState.setActivityBookingPage}
          />
          </div>
        </div>
      </div>
      
      <BookingModal
        isOpen={bookingModalState.showBookingModal}
        onClose={bookingModalState.closeBookingModal}
        facilities={facilities}
        selectedFacilityId={bookingModalState.selectedFacilityForBooking}
        initialStartTime={bookingModalState.initialStartForBooking}
        initialEndTime={bookingModalState.initialEndForBooking}
        showSuggestedSlot={bookingModalState.initialTimesAreSuggested}
        bookingToEdit={bookingModalState.bookingToEdit}
      />
      
      <CancellationModal
        showCancelModal={cancelBookingModalState.showCancelModal}
        setShowCancelModal={cancelBookingModalState.setShowCancelModal}
        bookingToCancel={cancelBookingModalState.bookingToCancel}
        cancelBookingMutationStatus={cancelBookingMutation.status}
        getFacilityDisplay={(id) => getFacilityDisplay(id, facilities, campuses)}
        confirmCancelBooking={confirmCancelBooking}
        cancelCancelBooking={cancelCancelBooking}
      />
    </div>
  );
}
