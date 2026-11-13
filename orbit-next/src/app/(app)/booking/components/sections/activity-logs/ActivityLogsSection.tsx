import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { SkeletonListItem } from "@/components/ui/skeleton-presets";
import { getEquipmentItemNames } from "@shared/equipmentFormatting";

interface ActivityLogsSectionProps {
  activityTab: "booking" | "notifications";
  onActivityTabChange: (tab: "booking" | "notifications") => void;
  activitySearchTerm: string;
  onSearchTermChange: (value: string) => void;
  activityBookingPage: number;
  setActivityBookingPage: Dispatch<SetStateAction<number>>;
  activityNotificationsPage: number;
  setActivityNotificationsPage: Dispatch<SetStateAction<number>>;
  bookingsPerPage: number;
  notificationsPerPage: number;
  userBookings: any[];
  notificationsData: any[];
  isUserBookingsLoading: boolean;
  isUserBookingsFetching: boolean;
  isNotificationsLoading: boolean;
  isNotificationsFetching: boolean;
  openOthers: Record<string, boolean>;
  setOpenOthers: Dispatch<SetStateAction<Record<string, boolean>>>;
  getBookingStatus: (booking: any) => { label: string; badgeClass: string };
  getFacilityDisplay: (facilityId: number) => string;
  parseEquipmentFromMessage: (message: string) => { baseMessage: string; equipment: any };
  onNavigateToBookingDetails: (bookingId: string) => void;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  markNotificationReadPending: boolean;
}

const NOTIFICATIONS_BATCH_SIZE = 10;

export function ActivityLogsSection({
  notificationsData,
  isNotificationsLoading,
  isNotificationsFetching,
  parseEquipmentFromMessage,
}: ActivityLogsSectionProps) {
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_BATCH_SIZE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Filter notifications by date range
  const filteredNotifications = useMemo(() => {
    if (!dateFrom && !dateTo) return notificationsData;
    return notificationsData.filter((n: any) => {
      try {
        const created = new Date(n.createdAt);
        if (dateFrom) {
          const from = startOfDay(parseISO(dateFrom));
          if (created < from) return false;
        }
        if (dateTo) {
          const to = endOfDay(parseISO(dateTo));
          if (created > to) return false;
        }
        return true;
      } catch {
        return true;
      }
    });
  }, [notificationsData, dateFrom, dateTo]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(NOTIFICATIONS_BATCH_SIZE);
  }, [dateFrom, dateTo]);

  // Infinite scroll - load more when sentinel is visible
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredNotifications.length) {
          setVisibleCount((prev) => Math.min(prev + NOTIFICATIONS_BATCH_SIZE, filteredNotifications.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredNotifications.length]);

  const visibleNotifications = filteredNotifications.slice(0, visibleCount);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Activity Logs</h3>
          <p className="text-sm text-gray-600 mt-1">Your latest notifications and activity updates</p>
        </div>
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="date-from" className="text-xs font-medium text-gray-600">From</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="date-to" className="text-xs font-medium text-gray-600">To</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {(isNotificationsLoading || isNotificationsFetching) ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonListItem key={index} />
            ))}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm">No notifications yet</p>
          </div>
        ) : (
          visibleNotifications.map((notification: any) => {
            return (
              <div
                key={notification.id}
                className="p-4 rounded-lg border border-pink-100 bg-pink-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium ${
                        notification.type === "BOOKING_APPROVED"
                          ? "bg-green-100 text-green-800"
                          : notification.type === "BOOKING_DENIED"
                          ? "bg-red-100 text-red-800"
                          : notification.type === "BOOKING_CANCELLED"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {notification.type?.replace(/_/g, " ") || "Notification"}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {notification.title || "Notification"}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap break-words">
                    {(notification.message || "").split("\n").map((line: string, idx: number) => (
                      <span key={idx} className="block">
                        {(() => {
                          const { baseMessage, equipment } = parseEquipmentFromMessage(line);
                          const equipmentItems = getEquipmentItemNames(equipment);
                          return (
                            <>
                              {baseMessage}
                              {equipmentItems.length > 0 ? (
                                <span className="mt-2 block">
                                  <span className="block text-[11px] font-semibold text-gray-700">
                                    Equipment requested:
                                  </span>
                                  <span className="mt-1 flex flex-wrap gap-1.5">
                                    {equipmentItems.map((itemKey: string) => (
                                      <span
                                        key={itemKey}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                        {itemKey.replace(/_/g, " ")}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                              ) : null}
                              {equipment && equipment.others ? (
                                <span className="mt-2 block">
                                  <span className="block text-[11px] font-semibold text-gray-700">
                                    Other notes:
                                  </span>
                                  <span className="text-xs text-gray-600 mt-1 block whitespace-pre-wrap break-words">
                                    {String(equipment.others)}
                                  </span>
                                </span>
                              ) : null}
                            </>
                          );
                        })()}
                      </span>
                    ))}
                  </p>
                  <p className="text-[11px] text-red-500 mt-2">
                    {format(new Date(notification.createdAt), "EEE, MMM d • hh:mm a")}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Scroll sentinel for infinite scroll */}
        {visibleCount < filteredNotifications.length && (
          <div ref={scrollSentinelRef} className="py-4 text-center">
            <p className="text-xs text-gray-400">Loading more notifications...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-100 mt-4">
        <p className="text-[11px] sm:text-sm text-gray-600">
          Showing {Math.min(visibleCount, filteredNotifications.length)} of {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? "s" : ""}
          {(dateFrom || dateTo) && filteredNotifications.length !== notificationsData.length && (
            <span className="text-gray-400"> (filtered from {notificationsData.length})</span>
          )}
        </p>
      </div>
    </div>
  );
}
