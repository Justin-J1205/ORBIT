"use client";

import React, { useEffect, useMemo } from "react";
import { SystemAlert } from "@shared/schema";
import { AdminSearchBar } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Users } from "lucide-react";
// Import directly from component files to avoid any barrel resolution issues
import { BookingTab } from "./tabs/booking";
import { UserTab } from "./tabs/user";

export type SystemAlertsSectionProps = {
  alerts: SystemAlert[];
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  securityTab: "booking" | "users";
  onSecurityTabChange: (value: "booking" | "users") => void;
  bookingAlertsPage: number;
  onBookingAlertsPageChange: (value: number | ((prev: number) => number)) => void;
  userAlertsPage: number;
  onUserAlertsPageChange: (value: number | ((prev: number) => number)) => void;
  formatAlertMessage: (message: string | null) => string;
  formatDateTime: (value: any) => string;
  safeJsonParse: (input: unknown) => any;
  getUserEmail: (id: any) => string;
  onNavigateToBooking: (bookingId: string | null) => void;
  onMarkAlertRead: (alert: SystemAlert) => void;
  isMarkingAlert?: boolean;
};

export function SystemAlertsSection({
  alerts,
  globalSearch,
  onGlobalSearchChange,
  securityTab,
  onSecurityTabChange,
  bookingAlertsPage,
  onBookingAlertsPageChange,
  userAlertsPage,
  onUserAlertsPageChange,
  formatAlertMessage,
  formatDateTime,
  safeJsonParse,
  getUserEmail,
  onNavigateToBooking,
  onMarkAlertRead,
  isMarkingAlert = false,
}: SystemAlertsSectionProps) {
  const normalizedSearch = globalSearch.trim().toLowerCase();

  const isComputerAlert = (alert: SystemAlert) => {
    const title = (alert.title || "").toLowerCase();
    const message = (alert.message || "").toLowerCase();
    return (
      title.includes("automatically logged out") ||
      title.includes("auto-logout") ||
      message.includes("inactivity")
    );
  };

  const bookingAlertsAll = useMemo(() => {
    return (alerts || [])
      .filter((alert) => {
        const title = (alert.title || "").toLowerCase();
        const message = (alert.message || "").toLowerCase();
        
        // Exclude equipment and needs alerts from booking alerts - they belong in User Management
        if (title.includes("equipment") || title.includes("needs") || 
            title.includes("request") && (message.includes("equipment") || message.includes("needs")) ||
            message.includes("equipment") || message.includes("needs") ||
            message.includes("[equipment:")) {
          return false;
        }
        
        // Include booking-related alerts
        if (alert.type === "booking") return true;
        return (
          title.includes("booking cancelled") ||
          title.includes("booking canceled") ||
          title.includes("booking") ||
          message.includes("booking")
        );
      })
      .filter((alert) => !isComputerAlert(alert));
  }, [alerts]);

  const userAlertsAll = useMemo(() => {
    return (alerts || []).filter((alert) => {
      const title = (alert.title || "").toLowerCase();
      const message = (alert.message || "").toLowerCase();
      return (
        title.includes("user banned") ||
        title.includes("user unbanned") ||
        title.includes("suspension") ||
        message.includes("banned") ||
        message.includes("unbanned") ||
        title.includes("equipment") ||
        title.includes("needs") ||
        message.includes("equipment") ||
        message.includes("needs")
      );
    });
  }, [alerts]);

  const bookingAlertsFiltered = useMemo(() => {
    if (!normalizedSearch) return bookingAlertsAll;
    return bookingAlertsAll.filter((alert) => {
      const title = (alert.title || "").toLowerCase();
      const message = (alert.message || "").toLowerCase();
      return title.includes(normalizedSearch) || message.includes(normalizedSearch);
    });
  }, [bookingAlertsAll, normalizedSearch]);

  const userAlertsFiltered = useMemo(() => {
    if (!normalizedSearch) return userAlertsAll;
    return userAlertsAll.filter((alert) => {
      const title = (alert.title || "").toLowerCase();
      const message = (alert.message || "").toLowerCase();
      return title.includes(normalizedSearch) || message.includes(normalizedSearch);
    });
  }, [userAlertsAll, normalizedSearch]);

  useEffect(() => {
    if (!normalizedSearch) return;
    const bookingMatches = bookingAlertsFiltered.length;
    const userMatches = userAlertsFiltered.length;

    if (securityTab === "booking" && bookingMatches === 0 && userMatches > 0) {
      onSecurityTabChange("users");
    } else if (securityTab === "users" && userMatches === 0 && bookingMatches > 0) {
      onSecurityTabChange("booking");
    } else if (securityTab !== "booking" && bookingMatches > 0) {
      onSecurityTabChange("booking");
    } else if (securityTab !== "users" && bookingMatches === 0 && userMatches > 0) {
      onSecurityTabChange("users");
    }
  }, [normalizedSearch, bookingAlertsFiltered.length, userAlertsFiltered.length, securityTab, onSecurityTabChange]);

  const bookingAlertsSorted = useMemo(() => {
    return [...bookingAlertsFiltered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [bookingAlertsFiltered]);

  const userAlertsSorted = useMemo(() => {
    return [...userAlertsFiltered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [userAlertsFiltered]);

  const bookingAlertsCount = bookingAlertsAll.length;
  const userAlertsCount = userAlertsAll.length;

  const tabUnread = securityTab === "users"
    ? userAlertsFiltered.filter((alert) => !alert.isRead).length
    : bookingAlertsFiltered.filter((alert) => !alert.isRead).length;

  const tabTotal = securityTab === "users"
    ? normalizedSearch
      ? `${userAlertsFiltered.length}/${userAlertsCount}`
      : userAlertsCount
    : normalizedSearch
      ? `${bookingAlertsFiltered.length}/${bookingAlertsCount}`
      : bookingAlertsCount;

  const handleGlobalSearchChange = (value: string) => {
    onGlobalSearchChange(value);
    onBookingAlertsPageChange(0);
    onUserAlertsPageChange(0);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">System Alerts</h2>
              <p className="text-xs sm:text-sm text-gray-600">Monitor system security alerts and notifications</p>
              <AdminSearchBar
                value={globalSearch}
                onChange={handleGlobalSearchChange}
                placeholder="Search alerts..."
                ariaLabel="System alerts search"
                className="pt-1"
              />
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-2 items-center">
            <div className="bg-orange-100 text-orange-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap text-center">
              {tabUnread || 0} alerts
            </div>
            <div className="bg-gray-100 text-gray-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap text-center">
              {tabTotal || 0} Total
            </div>
          </div>
        </div>

        <Tabs
          value={securityTab}
          onValueChange={(value) => onSecurityTabChange(value as "booking" | "users")}
          className="space-y-4 sm:space-y-6"
        >
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 gap-2">
            <TabsTrigger
              value="booking"
              onClick={() => onSecurityTabChange("booking")}
              className="w-full whitespace-normal flex items-center justify-start md:justify-center gap-2 text-left md:text-center"
            >
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <span className="truncate">Booking Alerts</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              onClick={() => onSecurityTabChange("users")}
              className="w-full whitespace-normal flex items-center justify-start md:justify-center gap-2 text-left md:text-center"
            >
              <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="truncate">User Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="booking" className="space-y-4 mt-6 md:mt-0">
            <BookingTab
              bookingAlertsSorted={bookingAlertsSorted}
              bookingAlertsPage={bookingAlertsPage}
              onBookingAlertsPageChange={onBookingAlertsPageChange}
              formatDateTime={formatDateTime}
              formatAlertMessage={formatAlertMessage}
              safeJsonParse={safeJsonParse}
              onNavigateToBooking={onNavigateToBooking}
              onMarkAlertRead={onMarkAlertRead}
              isMarkingAlert={isMarkingAlert}
              normalizedSearch={normalizedSearch}
              bookingAlertsCount={bookingAlertsCount}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-6 md:mt-0">
            <UserTab
              userAlertsSorted={userAlertsSorted}
              userAlertsPage={userAlertsPage}
              onUserAlertsPageChange={onUserAlertsPageChange}
              formatDateTime={formatDateTime}
              formatAlertMessage={formatAlertMessage}
              safeJsonParse={safeJsonParse}
              onMarkAlertRead={onMarkAlertRead}
              isMarkingAlert={isMarkingAlert}
              normalizedSearch={normalizedSearch}
              userAlertsCount={userAlertsCount}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
