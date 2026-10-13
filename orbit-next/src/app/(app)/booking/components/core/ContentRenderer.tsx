import React from 'react';
import FaqList from '@/components/faq/FaqList';
import { MyBookingsSection } from '../sections/MyBookingsSection';
import { ActivityLogsSection } from '../sections/activity-logs/ActivityLogsSection';
import { AvailableRoomsSection } from '../sections/AvailableRoomsSection';
import { DashboardStatsSection } from '../dashboard/DashboardStatsSection';
import { DashboardRecentActivitySection } from '../dashboard/DashboardRecentActivitySection';

interface ContentRendererProps {
  selectedView: string;
  // My Bookings props
  user: any;
  currentUserEmail?: string;
  currentUserName?: string;
  userBookings: any[];
  facilities: any[];
  isUserBookingsLoading: boolean;
  isUserBookingsFetching: boolean;
  itemsPerPage: number;
  openBookingModal: (facilityId?: number, start?: Date, end?: Date) => Promise<void>;
  onRescheduleBooking: (booking: any) => void;
  getBookingStatus: (booking: any) => { label: string; badgeClass: string };
  getFacilityDisplay: (facilityId: number) => string;
  openOthers: Record<string, boolean>;
  setOpenOthers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onViewAllBookingHistory: () => void;
  canCancelBooking: (booking: any) => boolean;
  onCancelBooking: (booking: any) => void;
  cancelBookingMutationStatus: 'idle' | 'pending' | 'success' | 'error';
  onArrivalCountdownExpire: (booking: any) => void;
  onActiveCountdownExpire: (booking: any) => void;
  scrollToBookingId: string | null;
  onResetScrollHighlight: () => void;
  // Activity Logs props
  activityTab: 'booking' | 'notifications';
  onActivityTabChange: (tab: 'booking' | 'notifications') => void;
  activitySearchTerm: string;
  onSearchTermChange: (value: string) => void;
  activityBookingPage: number;
  activityNotificationsPage: number;
  setActivityNotificationsPage: React.Dispatch<React.SetStateAction<number>>;
  bookingsPerPage: number;
  notificationsPerPage: number;
  notificationsData: any[];
  isNotificationsLoading: boolean;
  isNotificationsFetching: boolean;
  parseEquipmentFromMessage: (message: string) => any;
  getEquipmentStatusColor: (status: string) => string;
  onNavigateToBookingDetails: (bookingId: string) => void;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  markNotificationReadPending: boolean;
  // Available Rooms props
  isFacilitiesLoading: boolean;
  isFacilitiesFetching: boolean;
  availabilityMap: Map<number, any>;
  unavailableDatesByFacility: Record<string, string[]>;
  getFacilityBookingStatus: (facilityId: number) => any;
  getFacilityDescriptionByName: (name?: string) => string;
  getFacilityImageByName: (name?: string) => string;
  formatFacilityName: (name: string) => string;
  isRestrictedFacility: (facility?: any) => boolean;
  isLibraryClosedNow: () => boolean;
  devForceOpen: boolean;
  setDevForceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedFacilityForBooking: (id: number | null) => void;
  setInitialStartForBooking: (date: Date | null) => void;
  setInitialEndForBooking: (date: Date | null) => void;
  setInitialTimesAreSuggested: (value: boolean) => void;
  toast: any;
  // Stats
  stats: { active: number; upcoming: number; pending: number };
  setSelectedView: (view: string) => void;
  setActivityTab: (tab: 'booking' | 'notifications') => void;
  setActivityBookingPage: React.Dispatch<React.SetStateAction<number>>;
}

export function ContentRenderer(props: ContentRendererProps) {
  const { selectedView } = props;

  switch (selectedView) {
    case "my-bookings":
      return (
        <MyBookingsSection
          user={props.user}
          userBookings={props.userBookings}
          facilities={props.facilities}
          isUserBookingsLoading={props.isUserBookingsLoading}
          isUserBookingsFetching={props.isUserBookingsFetching}
          itemsPerPage={props.itemsPerPage}
          openBookingModal={props.openBookingModal}
          onRescheduleBooking={props.onRescheduleBooking}
          getBookingStatus={props.getBookingStatus}
          getFacilityDisplay={props.getFacilityDisplay}
          openOthers={props.openOthers}
          setOpenOthers={props.setOpenOthers}
          onViewAllBookingHistory={props.onViewAllBookingHistory}
          canCancelBooking={props.canCancelBooking}
          onCancelBooking={props.onCancelBooking}
          cancelBookingMutationStatus={props.cancelBookingMutationStatus}
          onArrivalCountdownExpire={props.onArrivalCountdownExpire}
          onActiveCountdownExpire={props.onActiveCountdownExpire}
          scrollToBookingId={props.scrollToBookingId}
          onResetScrollHighlight={props.onResetScrollHighlight}
        />
      );

    case "activity-logs":
      return (
        <ActivityLogsSection
          activityTab={props.activityTab}
          onActivityTabChange={props.onActivityTabChange}
          activitySearchTerm={props.activitySearchTerm}
          onSearchTermChange={props.onSearchTermChange}
          activityBookingPage={props.activityBookingPage}
          setActivityBookingPage={props.setActivityBookingPage}
          activityNotificationsPage={props.activityNotificationsPage}
          setActivityNotificationsPage={props.setActivityNotificationsPage}
          bookingsPerPage={props.bookingsPerPage}
          notificationsPerPage={props.notificationsPerPage}
          userBookings={props.userBookings}
          notificationsData={props.notificationsData}
          isUserBookingsLoading={props.isUserBookingsLoading}
          isUserBookingsFetching={props.isUserBookingsFetching}
          isNotificationsLoading={props.isNotificationsLoading}
          isNotificationsFetching={props.isNotificationsFetching}
          openOthers={props.openOthers}
          setOpenOthers={props.setOpenOthers}
          getBookingStatus={props.getBookingStatus}
          getFacilityDisplay={props.getFacilityDisplay}
          parseEquipmentFromMessage={props.parseEquipmentFromMessage}
          onNavigateToBookingDetails={props.onNavigateToBookingDetails}
          onMarkNotificationRead={props.onMarkNotificationRead}
          markNotificationReadPending={props.markNotificationReadPending}
        />
      );

    case "faqs":
      return (
        <div className="bg-white/0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                Frequently Asked Questions
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Find quick answers about booking policies, facilities, and support.
              </p>
            </div>
            <FaqList />
          </div>
        </div>
      );

    case "available-rooms":
      return (
        <AvailableRoomsSection
          user={props.user}
          facilities={props.facilities}
          isFacilitiesLoading={props.isFacilitiesLoading}
          isFacilitiesFetching={props.isFacilitiesFetching}
          availabilityMap={props.availabilityMap}
          unavailableDatesByFacility={props.unavailableDatesByFacility}
          getFacilityBookingStatus={props.getFacilityBookingStatus}
          getFacilityDescriptionByName={props.getFacilityDescriptionByName}
          getFacilityImageByName={props.getFacilityImageByName}
          formatFacilityName={props.formatFacilityName}
          isRestrictedFacility={props.isRestrictedFacility}
          isLibraryClosedNow={props.isLibraryClosedNow}
          devForceOpen={props.devForceOpen}
          setDevForceOpen={props.setDevForceOpen}
          openBookingModal={props.openBookingModal}
          setSelectedFacilityForBooking={props.setSelectedFacilityForBooking}
          setInitialStartForBooking={props.setInitialStartForBooking}
          setInitialEndForBooking={props.setInitialEndForBooking}
          setInitialTimesAreSuggested={props.setInitialTimesAreSuggested}
          toast={props.toast}
        />
      );

    default:
      return (
        <>
          <DashboardStatsSection
            stats={props.stats}
            isLoading={props.isUserBookingsLoading || props.isUserBookingsFetching}
            onSelectMyBookings={() => props.setSelectedView("my-bookings")}
          />

          <AvailableRoomsSection
            user={props.user}
            facilities={props.facilities}
            isFacilitiesLoading={props.isFacilitiesLoading}
            isFacilitiesFetching={props.isFacilitiesFetching}
            availabilityMap={props.availabilityMap}
            unavailableDatesByFacility={props.unavailableDatesByFacility}
            getFacilityBookingStatus={props.getFacilityBookingStatus}
            getFacilityDescriptionByName={props.getFacilityDescriptionByName}
            getFacilityImageByName={props.getFacilityImageByName}
            formatFacilityName={props.formatFacilityName}
            isRestrictedFacility={props.isRestrictedFacility}
            isLibraryClosedNow={props.isLibraryClosedNow}
            devForceOpen={props.devForceOpen}
            setDevForceOpen={props.setDevForceOpen}
            openBookingModal={props.openBookingModal}
            setSelectedFacilityForBooking={props.setSelectedFacilityForBooking}
            setInitialStartForBooking={props.setInitialStartForBooking}
            setInitialEndForBooking={props.setInitialEndForBooking}
            setInitialTimesAreSuggested={props.setInitialTimesAreSuggested}
            toast={props.toast}
            className="mb-6 sm:mb-8"
          />

          <DashboardRecentActivitySection
            currentUserEmail={props.currentUserEmail}
            currentUserName={props.currentUserName}
            user={props.user}
            userBookings={props.userBookings}
            isUserBookingsLoading={props.isUserBookingsLoading}
            isUserBookingsFetching={props.isUserBookingsFetching}
            itemsPerPage={props.itemsPerPage}
            openOthers={props.openOthers}
            setOpenOthers={props.setOpenOthers}
            getBookingStatus={props.getBookingStatus}
            getFacilityDisplay={props.getFacilityDisplay}
            onSelectViewAllBookingHistory={() => {
              props.setSelectedView("my-bookings");
            }}
            onNavigateToBookingDetails={props.onNavigateToBookingDetails}
            onArrivalCountdownExpire={props.onArrivalCountdownExpire}
            onActiveCountdownExpire={props.onActiveCountdownExpire}
          />
        </>
      );
  }
}
