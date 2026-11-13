import { Dispatch, SetStateAction } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { SkeletonListItem } from "@/components/ui/skeleton-presets";
import { getEquipmentItemNames } from "@shared/equipmentFormatting";

interface NotificationsTabProps {
  notificationsData: any[];
  isNotificationsLoading: boolean;
  isNotificationsFetching: boolean;
  searchTerm: string;
  activityNotificationsPage: number;
  setActivityNotificationsPage: Dispatch<SetStateAction<number>>;
  notificationsPerPage: number;
  parseEquipmentFromMessage: (message: string) => { baseMessage: string; equipment: any };
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  markNotificationReadPending: boolean;
}

export function NotificationsTab({
  notificationsData,
  isNotificationsLoading,
  isNotificationsFetching,
  searchTerm,
  activityNotificationsPage,
  setActivityNotificationsPage,
  notificationsPerPage,
  parseEquipmentFromMessage,
  onMarkNotificationRead,
  markNotificationReadPending,
}: NotificationsTabProps) {
  const filteredNotifications = notificationsData.filter((notification: any) => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    const title = String(notification.title || "").toLowerCase();
    const message = String(notification.message || "").toLowerCase();
    const type = String(notification.type || "").toLowerCase();
    return title.includes(lowerSearch) || message.includes(lowerSearch) || type.includes(lowerSearch);
  });

  if (isNotificationsLoading || isNotificationsFetching) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonListItem key={index} />
        ))}
      </div>
    );
  }

  if (filteredNotifications.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 text-sm">
          {searchTerm ? "No notifications match your search" : "No notifications yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredNotifications
        .slice(
          activityNotificationsPage * notificationsPerPage,
          (activityNotificationsPage + 1) * notificationsPerPage
        )
        .map((notification: any) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border ${
              notification.readAt
                ? "border-gray-100 bg-gray-50"
                : "border-pink-100 bg-pink-50"
            } flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium ${
                    notification.type === "BOOKING_APPROVED"
                      ? "bg-green-100 text-green-800"
                      : notification.type === "BOOKING_DENIED"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {notification.type?.replace(/_/g, " ") || "Notification"}
                </span>
                {!notification.readAt && (
                  <span className="text-[10px] text-pink-600 font-medium uppercase tracking-wide">
                    New
                  </span>
                )}
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
                            <div className="mt-2">
                              <span className="block text-[11px] font-semibold text-gray-700">
                                Equipment requested:
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {equipmentItems.map((itemKey: string) => (
                                  <span
                                    key={itemKey}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                    {itemKey.replace(/_/g, " ")}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {equipment && equipment.others ? (
                            <div className="mt-2">
                              <span className="block text-[11px] font-semibold text-gray-700">
                                Other notes:
                              </span>
                              <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap break-words">
                                {String(equipment.others)}
                              </p>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </span>
                ))}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                {format(new Date(notification.createdAt), "EEE, MMM d • hh:mm a")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <button
                onClick={async () => {
                  if (notification.readAt) return;
                  await onMarkNotificationRead(notification.id);
                }}
                disabled={notification.readAt || markNotificationReadPending}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  notification.readAt
                    ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                    : "bg-pink-600 text-white hover:bg-pink-700"
                }`}
              >
                {markNotificationReadPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">Reading...</span>
                  </span>
                ) : (
                  "Mark Read"
                )}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
