"use client";

import { Suspense, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/data";
import { AdminLayout, AdminContent, Countdown } from "../index";
import { 
  BanUserModal, 
  UnbanUserModal, 
  UnbanSuccessModal,
  ScheduleReportModal, 
  DeleteScheduleConfirmModal 
} from "@/components/modals";
import { formatDateTime, formatDate, formatTime, WEEKDAY_LABELS, safeJsonParse, formatScheduleFrequencyText, extractRecipientList } from "@admin";
import { useLegacyLocation } from "@/lib/utils";
import { useAdminState } from "@admin/hooks/state";
import { useAdminNavigation, useSidebarItems, useSidebarClickHandler } from "@admin/hooks/navigation";
import { useAdminQueries, useAdminDataSync, useAdminDataManagement } from "@admin/hooks/data";
import { useInvalidateOnAdminChange, useAdminHandlers, useModalHandlers } from "@admin/hooks/effects";
import { useReportScheduleFiltering } from "@admin/hooks/state/useReportScheduleState";
import { PIE_CHART_COLORS, FACILITY_BAR_COLORS, WEEKLY_LINE_COLORS, ENABLE_QUICK_ACTIONS, DEBUG_MINIMAL_RENDER, DEBUG_OVERVIEW_SECTIONS, DEBUG_ANALYTICS_CHARTS, ANY_ANALYTICS_ENABLED } from "@admin/config";
import { AdminSuspenseFallback } from "../layout/AdminSuspenseFallback";

// Moved into `core/` for structural clarity. No logic changes.
function AdminDashboardContent() {
  const state = useAdminState();
  const {
    setSelectedView, setSecurityTab, setSettingsTab, setLocation: _unusedSetLocation,
    isExportingPdf, setIsExportingPdf, setUnavailableDatesByFacility,
  } = state as any;

  const { user: authUser, isLoading: authLoading, requiresPasswordSetup } = useAuth();
  const [location, setLocation] = useLegacyLocation();

  useAdminNavigation({ location, setSelectedView, setSecurityTab });
  const sidebarItems = useSidebarItems(authUser, state.isNavigatingToBooking);
  const handleSidebarClick = useSidebarClickHandler({
    setUserTab: state.setUserTab,
    setSecurityTab,
    setSettingsTab,
    setSelectedView,
    setLocation,
    setIsNavigatingToBooking: state.setIsNavigatingToBooking,
  });

  const queryClient = useQueryClient();
  const effectiveUser = authUser;
  const authReady = !!effectiveUser && !authLoading;
  const isAdmin = authReady && effectiveUser.role === 'admin';

  useEffect(() => {
    if (authLoading) return;
    if (!effectiveUser) {
      setLocation('/login');
      return;
    }
    if (requiresPasswordSetup) {
      setLocation('/create-password');
      return;
    }
    if (effectiveUser.role !== 'admin') {
      setLocation('/booking');
    }
  }, [authLoading, effectiveUser, requiresPasswordSetup, setLocation]);

  const queries = useAdminQueries({ isAdmin });
  const { usersData: usersDataQ, activitiesData, facilitiesData, campusesData, adminBookingsData, currentUserData, reportSchedulesData } = queries as any;

  const authUserId = authUser?.id ?? null;
  useInvalidateOnAdminChange(authUserId, isAdmin, queryClient);

  useAdminDataSync(
    { usersDataQ, activitiesData, facilitiesData, adminBookingsData, currentUserData },
    { setUsersData: state.setUsersData, setActivities: state.setActivities, setFacilities: state.setFacilities, setUnavailableDatesByFacility, setUser: state.setUser }
  );

  // Store users globally for handlers to access
  useEffect(() => {
    if (usersDataQ) {
      (window as any).__adminUsers = usersDataQ;
    }
  }, [usersDataQ]);

  const allBookings = Array.isArray(adminBookingsData) ? adminBookingsData : [];

  const dataManagement = useAdminDataManagement({
    allBookings,
    pendingBookingsData: (queries as any).pendingBookingsData,
    facilitiesData,
    facilities: state.facilities || [],
    campusesData: campusesData || [],
    reportSchedulesData,
    adminBookingsData,
    getFacilityName: state.getFacilityName,
    formatDateTime,
    setUnavailableDatesByFacility,
  });

  const handlers = useAdminHandlers({
    setSelectedView,
    setBookingTab: state.setBookingTab,
    setLocation,
    setGlobalUserManagementSearch: state.setGlobalUserManagementSearch,
    setBookingUsersPage: state.setBookingUsersPage,
    setBannedUsersPage: state.setBannedUsersPage,
    setUserToBan: state.setUserToBan,
    setIsBanUserModalOpen: state.setIsBanUserModalOpen,
    setUserToUnban: state.setUserToUnban,
    setIsUnbanUserModalOpen: state.setIsUnbanUserModalOpen,
    setUnbannedUserEmail: state.setUnbannedUserEmail,
    setIsUnbanSuccessModalOpen: state.setIsUnbanSuccessModalOpen,
    setGlobalSystemAlertsSearch: state.setGlobalSystemAlertsSearch,
    setBookingAlertsPage: state.setBookingAlertsPage,
    setUserAlertsPage: state.setUserAlertsPage,
    setFacilityForUnavailable: state.setFacilityForUnavailable,
    setIsUnavailableModalOpen: state.setIsUnavailableModalOpen,
    setIsScheduleReportModalOpen: state.setIsScheduleReportModalOpen,
    setScheduleToEdit: state.setScheduleToEdit,
    setDeleteScheduleTarget: state.setDeleteScheduleTarget,
    setScheduleActionLoadingId: state.setScheduleActionLoadingId,
    setSchedulePaginationPage: state.setSchedulePaginationPage,
    setScheduleSearchTerm: state.setScheduleSearchTerm,
    schedulePaginationPage: state.schedulePaginationPage || 0,
    markAlertReadMutation: (dataManagement as any).markAlertReadMutation,
    banUserMutation: (dataManagement as any).banUserMutation,
    unbanUserMutation: (dataManagement as any).unbanUserMutation,
    toggleFacilityAvailabilityMutation: (dataManagement as any).toggleFacilityAvailabilityMutation,
    toggleScheduleActiveMutation: (dataManagement as any).toggleScheduleActiveMutation,
    getUserEmail: state.getUserEmail,
    allBookings,
    facilities: state.facilities,
    alertsData: (queries as any).alertsData,
  });

  const modalHandlers = useModalHandlers({
    facilityForUnavailable: state.facilityForUnavailable,
    setFacilityForUnavailable: state.setFacilityForUnavailable,
    setIsUnavailableModalOpen: state.setIsUnavailableModalOpen,
    setUnavailableDatesByFacility,
    toggleFacilityAvailabilityMutation: (dataManagement as any).toggleFacilityAvailabilityMutation,
    adminBookingsData,
    getFacilityName: state.getFacilityName,
    getUserEmail: state.getUserEmail,
    isExportingPdf,
    setIsExportingPdf,
  });

  // Report schedule filtering
  const scheduleFiltering = useReportScheduleFiltering(
    reportSchedulesData || [],
    state.scheduleSearchTerm || '',
    state.scheduleFilter || 'all',
    state.scheduleSort || 'next-run',
    state.schedulePaginationPage || 0,
    state.pageSize || 10
  );

  return (
    <AdminLayout
      mobileSidebarOpen={state.mobileSidebarOpen}
      setMobileSidebarOpen={state.setMobileSidebarOpen}
      sidebarItems={sidebarItems}
      selectedView={state.selectedView}
      handleSidebarClick={handleSidebarClick}
    >
      <AdminContent
        {...state as any}
        {...queries as any}
        {...dataManagement as any}
        {...handlers as any}
        {...modalHandlers as any}
        {...scheduleFiltering}
        setLocation={setLocation}
        selectedView={state.selectedView}
        setSelectedView={state.setSelectedView}
        setBookingTab={state.setBookingTab}
        setSettingsTab={state.setSettingsTab}
        setSecurityTab={state.setSecurityTab}
        mobileSidebarOpen={state.mobileSidebarOpen}
        setMobileSidebarOpen={state.setMobileSidebarOpen}
        sidebarItems={sidebarItems}
        handleSidebarClick={handleSidebarClick}
        user={state.user}
        formatDateTime={formatDateTime}
        formatDate={formatDate}
        formatTime={formatTime}
        safeJsonParse={safeJsonParse}
        WEEKDAY_LABELS={WEEKDAY_LABELS}
        formatScheduleFrequencyText={formatScheduleFrequencyText}
        extractRecipientList={extractRecipientList}
        weekdayLabels={WEEKDAY_LABELS}
        onScheduleSearchChange={handlers.handleScheduleSearchChange}
        onScheduleFilterChange={state.setScheduleFilter}
        onScheduleSortChange={state.setScheduleSort}
        onSchedulePaginationPrev={handlers.handleSchedulePaginationPrev}
        onSchedulePaginationNext={handlers.handleSchedulePaginationNext}
        PIE_CHART_COLORS={PIE_CHART_COLORS}
        FACILITY_BAR_COLORS={FACILITY_BAR_COLORS}
        WEEKLY_LINE_COLORS={WEEKLY_LINE_COLORS}
        ENABLE_QUICK_ACTIONS={ENABLE_QUICK_ACTIONS}
        DEBUG_OVERVIEW_SECTIONS={DEBUG_OVERVIEW_SECTIONS}
        DEBUG_ANALYTICS_CHARTS={DEBUG_ANALYTICS_CHARTS}
        ANY_ANALYTICS_ENABLED={ANY_ANALYTICS_ENABLED}
        CountdownComponent={Countdown}
      />
      
      {/* Global Ban User Modal - outside AdminContent to prevent unmounting */}
      <BanUserModal
        isOpen={!!state.isBanUserModalOpen}
        onClose={() => state.setIsBanUserModalOpen?.(false)}
        user={state.userToBan || null}
        onBanUser={handlers.handleBanUser || (() => {})}
      />

      {/* Global Unban User Modal */}
      <UnbanUserModal
        isOpen={!!state.isUnbanUserModalOpen}
        onClose={() => state.setIsUnbanUserModalOpen?.(false)}
        user={state.userToUnban || null}
        onUnbanUser={handlers.handleUnbanUser || (() => {})}
        isLoading={(dataManagement as any).unbanUserMutation?.isPending}
      />

      {/* Unban Success Modal */}
      <UnbanSuccessModal
        isOpen={!!state.isUnbanSuccessModalOpen}
        onClose={() => state.setIsUnbanSuccessModalOpen?.(false)}
        userEmail={state.unbannedUserEmail || ""}
      />

      {/* Schedule Report Modal */}
      <ScheduleReportModal
        isOpen={!!state.isScheduleReportModalOpen}
        onClose={() => {
          state.setIsScheduleReportModalOpen?.(false);
          state.setScheduleToEdit?.(null);
        }}
        scheduleToEdit={state.scheduleToEdit || null}
      />

      {/* Delete Schedule Confirmation Modal */}
      <DeleteScheduleConfirmModal
        isOpen={!!state.deleteScheduleTarget}
        onClose={() => state.setDeleteScheduleTarget?.(null)}
        schedule={state.deleteScheduleTarget || null}
      />
    </AdminLayout>
  );
}

function AdminDashboardInner() {
  if (DEBUG_MINIMAL_RENDER) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Admin Dashboard (debug stub)</h1>
        <p className="text-sm text-gray-500 mt-2">Full dashboard temporarily disabled while isolating the render loop.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<AdminSuspenseFallback />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

export default function AdminPageClient() {
  return (
    <Suspense fallback={<AdminSuspenseFallback />}>
      <AdminDashboardInner />
    </Suspense>
  );
}
