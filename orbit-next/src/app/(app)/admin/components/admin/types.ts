import React from "react";
import type { FacilityBooking, SystemAlert, User } from "@shared/schema";

export interface StatsCardsProps {
  activeBookings: FacilityBooking[];
  upcomingBookings: FacilityBooking[];
  userManagementAlerts: SystemAlert[];
  onNavigateToBookingManagement: (tab: string) => void;
  onNavigateToSecurity: () => void;
}

export interface QuickActionsBarProps {
  isExportingPdf: boolean;
  handleExportPdf: () => Promise<void>;
  generateBookingWeeklyReport?: () => void;
  facilityFilter: string;
  setFacilityFilter: (value: string) => void;
  facilitySort: 'asc' | 'desc';
  setFacilitySort: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  facilityOptions: Array<{ id: string; name: string }>;
}

export interface AnalyticsChartsProps {
  DEBUG_ANALYTICS_CHARTS: { department: boolean; facility: boolean; weekly: boolean };
  PIE_CHART_COLORS: string[];
  FACILITY_BAR_COLORS: { hours: string; bookings: string };
  WEEKLY_LINE_COLORS: { total: string; approved: string; pending: string };
  departmentChartData: Array<{ name: string; value: number }>;
  facilityUtilizationData: Array<{ name: string; hours: number; bookings: number }>;
  weeklyTrendData: Array<{ week: string; total: number; approved: number; pending: number }>;
  campusOptions: Array<{ id: string; name: string }>;
  selectedAnalyticsCampusId: string;
  setSelectedAnalyticsCampusId: (value: string) => void;
}

export interface AvailabilityPreviewProps {
  unavailableDatesByFacility: Record<string, string[]>;
}

export interface BookingPreviewsProps {
  upcomingBookings: FacilityBooking[];
  recentBookings: FacilityBooking[];
  scheduledCount: number;
  facilityFilter: string;
  setFacilityFilter: (value: string) => void;
  facilitySort: 'asc' | 'desc';
  setFacilitySort: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  facilityOptions: Array<{ id: string; name: string }>;
  getFacilityName: (id: any) => string;
  getUserEmail: (id: any) => string;
  formatDateTime: (value: any) => string;
  renderStatusBadge: (status: any) => React.ReactNode;
  onNavigateToBookingManagement: (tab: string) => void;
  onNavigateToActivityLogs: (tab: string) => void;
  setLocation: (path: string) => void;
}

export interface AlertsPreviewProps {
  alerts: SystemAlert[];
  alertsPreviewTab: 'booking' | 'users';
  setAlertsPreviewTab: (tab: 'booking' | 'users') => void;
  formatDateTime: (value: any) => string;
  formatAlertMessage: (message: string) => string;
  safeJsonParse: (jsonStr: string) => any;
  onNavigateToSecurity: (tab: 'booking' | 'users') => void;
}

export interface ActivityPreviewProps {
  activities: any[];
  user: User | null;
  usersMap: Map<string, User>;
  usersData: User[];
  allBookings: FacilityBooking[];
  getUserEmail: (id: any) => string;
  getFacilityName: (id: any) => string;
  formatDateTime: (value: any) => string;
  formatAlertMessage: (message: string) => string;
  safeJsonParse: (jsonStr: string) => any;
  onNavigateToActivityLogs: (tab: string) => void;
}

// Flags controlling which overview sections render
export interface AdminOverviewFlags {
  DEBUG_OVERVIEW_SECTIONS: Record<string, boolean>;
  ENABLE_QUICK_ACTIONS: boolean;
  ANY_ANALYTICS_ENABLED: boolean;
  DEBUG_ANALYTICS_CHARTS: { department: boolean; facility: boolean; weekly: boolean };
}

// Convenience aggregated type for all overview component props together (not required but helpful)
// NOTE: Aggregated interface removed to avoid conflicting handler signatures.
