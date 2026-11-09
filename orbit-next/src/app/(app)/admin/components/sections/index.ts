// Section component exports
export { SettingsSection } from "./settings";
export { SystemAlertsSection } from "./system-alerts";
export { UserManagementSection } from "./user-management";
export { BookingManagementSection } from "./booking-management";
export { ReportSchedulesSection } from "./report-schedules";
export { AdminActivityLogsSection } from "./admin-activity-logs";

// Aggregated tab constants (object or array depending on section)
// Removed SETTINGS_TABS export (System Settings)
export { SYSTEM_ALERTS_TABS } from './system-alerts/tabs/index';
export { USER_MANAGEMENT_TABS } from './user-management/tabs';
export { BOOKING_MANAGEMENT_TABS } from './booking-management/tabs';
export { ADMIN_ACTIVITY_LOGS_TABS } from './admin-activity-logs/tabs/index';

// Individual tab constants re-export (optional granular imports)
// Removed settings/tabs/facilities re-export (System Settings)
export * from './system-alerts/tabs/booking';
// Updated path: canonical file is user.tsx (not users.tsx)
export * from './system-alerts/tabs/user';
export * from './user-management/tabs/booking-users';
export * from './user-management/tabs/banned-users';
export * from './booking-management/tabs/active';
export * from './booking-management/tabs/scheduled';
export * from './admin-activity-logs/tabs/success';
export * from './admin-activity-logs/tabs/history';
export * from './admin-activity-logs/tabs/system';

// Export the new CampusManagementSection and FacilityManagementSection from the admin sections index
export { default as CampusManagementSection } from "./campus-management/CampusManagementSection";
export { default as FacilityManagementSection } from "./facility-management/FacilityManagementSection";
