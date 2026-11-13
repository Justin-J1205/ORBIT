import React, { useState } from 'react';
// SystemAlert type intentionally treated as any to avoid path alias issues in nested tabs.
type SystemAlert = any;
import { Button } from '../../../../../../../components/ui/button';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../../../../components/ui/dialog';
import { Badge } from '../../../../../../../components/ui/badge';
import { Separator } from '../../../../../../../components/ui/separator';

export const SYSTEM_ALERTS_TAB_BOOKING = 'booking' as const;

const ALERTS_PER_PAGE = 10;

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export type BookingTabProps = {
  bookingAlertsSorted: SystemAlert[];
  bookingAlertsPage: number;
  onBookingAlertsPageChange: Setter<number>;
  formatDateTime: (value: any) => string;
  formatAlertMessage: (message: string | null) => string;
  safeJsonParse: (input: unknown) => any;
  onNavigateToBooking: (bookingId: string | null) => void;
  onMarkAlertRead: (alert: SystemAlert) => void;
  isMarkingAlert?: boolean;
  normalizedSearch: string;
  bookingAlertsCount: number;
};

export function BookingTab({
  bookingAlertsSorted,
  bookingAlertsPage,
  onBookingAlertsPageChange,
  formatDateTime,
  formatAlertMessage,
  safeJsonParse,
  onNavigateToBooking,
  onMarkAlertRead,
  isMarkingAlert = false,
  normalizedSearch,
  bookingAlertsCount,
}: BookingTabProps) {
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAlertClick = (alert: SystemAlert) => {
    setSelectedAlert(alert);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAlert(null);
  };

  const bookingTotalPages = Math.ceil(bookingAlertsSorted.length / ALERTS_PER_PAGE) || 1;
  const bookingStartIndex = bookingAlertsPage * ALERTS_PER_PAGE;
  const bookingPageItems = bookingAlertsSorted.slice(
    bookingStartIndex,
    bookingStartIndex + ALERTS_PER_PAGE,
  );

  const handleMarkAlertRead = (alert: SystemAlert) => {
    if (!alert.isRead) {
      onMarkAlertRead(alert);
    }
  };

  const renderBookingAlert = (alert: SystemAlert) => {
    const isHighPriority = alert.severity === "critical" || alert.severity === "high";
    const raw = String(alert.message || "");
    const bookingMatch = raw.match(/\[booking:([^\]]+)\]/);
    const bookingId = bookingMatch ? bookingMatch[1] : null;

    let needsObj: any = null;
    try {
      const needsMatch = raw.match(/Needs:\s*(\{[\s\S]*\})/i);
      if (needsMatch && needsMatch[1]) {
        needsObj = safeJsonParse(needsMatch[1]);
      }
    } catch (_error) {
      needsObj = null;
    }

    const mapToken = (token: string) => {
      const normalized = token.toLowerCase();
      if (normalized.includes("whiteboard")) return "Whiteboard & Markers";
      if (normalized.includes("projector")) return "Projector";
      if (normalized.includes("extension cord")) return "Extension Cord";
      if (normalized.includes("hdmi")) return "HDMI Cable";
      if (normalized.includes("extra chairs")) return "Extra Chairs";
      return token.replace(/[.,;]+$/g, "").trim();
    };

    let equipmentList: string[] = [];
    let othersText: string | null = null;

    const legacyEquipmentMatch = raw.match(/Requested equipment:\s*([^\[]+)/i);

    if (needsObj && Array.isArray(needsObj.items)) {
      const mapped: string[] = [];
      for (const item of needsObj.items) {
        const token = String(item).replace(/_/g, " ").trim();
        const lower = token.toLowerCase();
        if (lower.includes("others")) {
          const trailing = token.replace(/.*?others[:\s-]*/i, "").trim();
          if (trailing) othersText = othersText || trailing;
          continue;
        }
        mapped.push(mapToken(token));
      }
      equipmentList = mapped;
      if (!othersText && needsObj.others) {
        othersText = String(needsObj.others).trim() || null;
      }
    } else if (legacyEquipmentMatch && legacyEquipmentMatch[1]) {
      const parts = legacyEquipmentMatch[1]
        .split(/[,;]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);
      const mapped: string[] = [];
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower.includes("others")) {
          const trailing = part.replace(/.*?others[:\s-]*/i, "").trim();
          if (trailing) othersText = othersText || trailing;
          continue;
        }
        mapped.push(mapToken(part));
      }
      equipmentList = mapped;
      const extrasMatch = legacyEquipmentMatch[1].match(/Others?:\s*(.*)$/i);
      if (!othersText && extrasMatch && extrasMatch[1]) {
        othersText = String(extrasMatch[1]).trim() || null;
      }
    }

    let visibleTitle = String(alert.title || "");
    let titleRequesterEmail: string | null = null;
    try {
      const match = visibleTitle.match(/[—–-]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*$/);
      if (match && match[1]) {
        titleRequesterEmail = match[1];
        visibleTitle = visibleTitle
          .replace(/[—–-]\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\s*$/, "")
          .trim();
      }
    } catch (_error) {
      titleRequesterEmail = null;
    }

    const cleaned = raw
      .replace(/\s*\[booking:[^\]]+\]/, "")
      .replace(/\[Equipment:[^\]]*\]/, "")
      .replace(/Needs:\s*\{[\s\S]*?\}\s*/i, "")
      .replace(/Requested equipment:\s*([^\[]+)/i, "")
      .trim();

    const othersDisplay = othersText || (needsObj && needsObj.others ? String(needsObj.others).trim() : null);

    return (
      <div
        key={alert.id}
        className={`bg-white rounded-md p-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all duration-200 ${alert.isRead ? "opacity-60" : ""}`}
        onClick={() => handleAlertClick(alert)}
      >
        <div className="md:hidden space-y-2">
          <div className="flex items-start gap-2">
            <div className={`p-1.5 rounded-lg flex-shrink-0 ${isHighPriority ? "bg-red-100" : "bg-orange-100"}`}>
              <AlertTriangle
                className={`h-5 w-5 ${isHighPriority ? "text-red-600" : "text-orange-600"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 break-words">{visibleTitle}</p>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">{formatDateTime(alert.createdAt)}</div>
            <p className="text-xs text-gray-600 break-words whitespace-pre-wrap">{cleaned}</p>

            {equipmentList.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-gray-700">Requested equipment:</div>
                <ul className="text-xs text-gray-600 list-disc list-inside mt-1">
                  {equipmentList.map((item, index) => (
                    <li key={index} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
                {othersDisplay && (
                  <div className="mt-2">
                    <div className="p-2 text-xs text-gray-900 break-words whitespace-pre-wrap">
                      {othersDisplay}
                    </div>
                  </div>
                )}
              </div>
            )}

            {bookingId && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToBooking(bookingId);
                  }}
                  className="text-xs text-blue-600 underline"
                >
                  View booking
                </button>
              </div>
            )}

            <div className="mt-2">
              {alert.isRead ? (
                <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  Read
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAlertRead(alert);
                  }}
                  disabled={isMarkingAlert}
                >
                  Mark as Read
                </Button>
              )}
            </div>
          </div>

          {titleRequesterEmail ? (
            <div className="text-xs text-gray-500 break-words">{titleRequesterEmail}</div>
          ) : null}
        </div>

        <div className="hidden md:flex items-start gap-2">
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${isHighPriority ? "bg-red-100" : "bg-orange-100"}`}>
            <AlertTriangle
              className={`h-5 w-5 ${isHighPriority ? "text-red-600" : "text-orange-600"}`}
            />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-start justify-between">
              <div className="pr-4 min-w-0">
                <p className="font-medium text-sm text-gray-900">{visibleTitle}</p>
                {titleRequesterEmail ? (
                  <div className="text-xs text-gray-500 mt-0.5">{titleRequesterEmail}</div>
                ) : null}
                <div className="mt-1">
                  <p className="text-xs text-gray-600 break-words break-all whitespace-pre-wrap max-w-full">
                    {cleaned}
                  </p>
                  {equipmentList.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-700">Requested equipment:</div>
                      <ul className="text-xs text-gray-600 list-disc list-inside mt-1">
                        {equipmentList.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                      {othersDisplay && (
                        <div className="mt-2">
                          <div className="max-w-xs p-2 text-sm text-gray-900 break-words whitespace-pre-wrap">
                            {othersDisplay}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {bookingId && (
                    <div className="mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToBooking(bookingId);
                        }}
                        className="text-xs text-blue-600 underline"
                      >
                        View booking
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-44 text-right text-xs text-gray-500 flex flex-col items-end gap-1">
                <div className="w-full">{formatDateTime(alert.createdAt)}</div>
                {alert.isRead ? (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    Read
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAlertRead(alert);
                    }}
                    disabled={isMarkingAlert}
                  >
                    Mark as Read
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Booking System Alerts</h3>
        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
          {normalizedSearch ? `${bookingAlertsSorted.length}/${bookingAlertsCount}` : bookingAlertsCount} alerts
        </span>
      </div>

      <div className="space-y-3">
        {bookingAlertsSorted.length > 0 && bookingPageItems.map(renderBookingAlert)}
      </div>

      {bookingAlertsSorted.length === 0 && (
        <div className="text-center py-8">
          <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-600 text-sm">No booking system alerts</p>
        </div>
      )}

      {bookingAlertsSorted.length > ALERTS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200">
          <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {bookingStartIndex + 1} to {Math.min(bookingStartIndex + ALERTS_PER_PAGE, bookingAlertsSorted.length)} of {bookingAlertsSorted.length} alerts
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => onBookingAlertsPageChange(Math.max(bookingAlertsPage - 1, 0))}
              disabled={bookingAlertsPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 text-xs sm:text-sm font-medium whitespace-nowrap">
              {bookingAlertsPage + 1} of {bookingTotalPages}
            </span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() =>
                onBookingAlertsPageChange(
                  bookingAlertsSorted.length > (bookingAlertsPage + 1) * ALERTS_PER_PAGE
                    ? bookingAlertsPage + 1
                    : bookingAlertsPage,
                )
              }
              disabled={bookingAlertsSorted.length <= (bookingAlertsPage + 1) * ALERTS_PER_PAGE}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Booking Alert Details</DialogTitle>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-6 pt-4">
              {/* Severity */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Severity</h3>
                <Badge 
                  variant={
                    selectedAlert.severity === 'critical' || selectedAlert.severity === 'high' ? 'destructive' :
                    'secondary'
                  }
                  className="text-sm px-3 py-1"
                >
                  {selectedAlert.severity}
                </Badge>
              </div>

              <Separator />

              {/* Title */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Alert Title</h3>
                <p className="text-base font-medium">{selectedAlert.title}</p>
              </div>

              <Separator />

              {/* Message */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Message</h3>
                <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
                  {formatAlertMessage(String(selectedAlert.message || ''))}
                </p>
              </div>

              <Separator />

              {/* Timestamp */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Created At</h3>
                <p className="text-base">{formatDateTime(selectedAlert.createdAt)}</p>
              </div>

              {/* Type */}
              {selectedAlert.type && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">Type</h3>
                    <Badge variant="outline">{selectedAlert.type}</Badge>
                  </div>
                </>
              )}

              {/* Status */}
              <Separator />
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Status</h3>
                <Badge variant={selectedAlert.isRead ? 'secondary' : 'default'}>
                  {selectedAlert.isRead ? 'Read' : 'Unread'}
                </Badge>
              </div>

              {/* Alert ID */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  Alert ID: <span className="font-mono">{selectedAlert.id}</span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
