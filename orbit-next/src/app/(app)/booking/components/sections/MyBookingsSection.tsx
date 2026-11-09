import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Calendar, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SkeletonListItem } from "@/components/ui/skeleton-presets";

type CategoryFilter = "all" | "scheduled" | "completed" | "cancelled";

interface MyBookingsSectionProps {
  user: any;
  userBookings: any[];
  facilities: any[];
  isUserBookingsLoading: boolean;
  isUserBookingsFetching: boolean;
  itemsPerPage: number;
  openBookingModal: (facilityId?: number, start?: Date, end?: Date) => void;
  onRescheduleBooking: (booking: any) => void;
  getBookingStatus: (booking: any) => { label: string; badgeClass: string };
  getFacilityDisplay: (facilityId: number) => string;
  openOthers: Record<string, boolean>;
  setOpenOthers: Dispatch<SetStateAction<Record<string, boolean>>>;
  onViewAllBookingHistory: () => void;
  canCancelBooking: (booking: any) => boolean;
  onCancelBooking: (booking: any) => void;
  cancelBookingMutationStatus: "idle" | "pending" | "success" | "error";
  onArrivalCountdownExpire?: (booking: any) => void;
  onActiveCountdownExpire?: (booking: any) => void;
  scrollToBookingId?: string | null;
  onResetScrollHighlight?: () => void;
}

function Countdown({ expiry, onExpire }: { expiry: string | Date | undefined; onExpire?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  const expiredFor = useRef<number | null>(null);

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!expiry || now === null) return;
    const expiryTime = new Date(expiry).getTime();
    if (expiryTime <= now && expiredFor.current !== expiryTime) {
      expiredFor.current = expiryTime;
      onExpire?.();
    }
  }, [expiry, now, onExpire]);

  if (!expiry) return <span />;
  if (now === null) return <span className="font-mono text-base font-semibold">--:--:--</span>;

  const diff = Math.max(0, new Date(expiry).getTime() - now);
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);

  return (
    <span className="font-mono text-base font-semibold">
      {hours.toString().padStart(2, "0")}:{mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export function MyBookingsSection({
  user,
  userBookings,
  facilities,
  isUserBookingsLoading,
  isUserBookingsFetching,
  itemsPerPage,
  openBookingModal,
  onRescheduleBooking,
  getBookingStatus,
  getFacilityDisplay,
  openOthers,
  setOpenOthers,
  onViewAllBookingHistory,
  canCancelBooking,
  onCancelBooking,
  cancelBookingMutationStatus,
  onArrivalCountdownExpire,
  onActiveCountdownExpire,
  scrollToBookingId,
  onResetScrollHighlight,
}: MyBookingsSectionProps) {
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const initialTimeout = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const getRenderBookingStatus = useCallback((booking: any) => {
    if (currentTime !== null) return getBookingStatus(booking);
    if (booking.status === "approved") return { label: "Scheduled", badgeClass: "bg-yellow-100 text-yellow-800" };
    if (booking.status === "pending") return { label: "Pending", badgeClass: "bg-blue-100 text-blue-800" };
    if (booking.status === "denied") return { label: "Denied", badgeClass: "denied" };
    if (booking.status === "cancelled") return { label: "Cancelled", badgeClass: "cancelled" };
    return { label: booking.status, badgeClass: booking.status };
  }, [currentTime, getBookingStatus]);

  const queryClient = useQueryClient();
  const confirmArrivalMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest('POST', `/api/bookings/${bookingId}/confirm-arrival`);
      if (!res.ok) throw new Error('Failed to confirm arrival');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
  });

  const toggleExpand = useCallback((id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Filter bookings based on category + date range
  const filteredBookings = useMemo(() => {
    return userBookings.filter((booking) => {
      const status = getRenderBookingStatus(booking);
      // Category filter
      if (categoryFilter === "scheduled") {
        if (!["Scheduled", "Active", "Pending"].includes(status.label)) return false;
      } else if (categoryFilter === "completed") {
        if (status.label !== "Completed") return false;
      } else if (categoryFilter === "cancelled") {
        if (status.label !== "Cancelled" && status.label !== "Denied") return false;
      }
      // Date range filter
      if (dateFrom) {
        const fromDate = startOfDay(parseISO(dateFrom));
        if (new Date(booking.startTime) < fromDate) return false;
      }
      if (dateTo) {
        const toDate = endOfDay(parseISO(dateTo));
        if (new Date(booking.startTime) > toDate) return false;
      }
      return true;
    });
  }, [userBookings, getRenderBookingStatus, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!scrollToBookingId) return;
    const el = document.getElementById(`booking-${scrollToBookingId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-pink-400", "ring-offset-2");
    const timer = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-pink-400", "ring-offset-2");
      onResetScrollHighlight?.();
    }, 2500);
    return () => {
      window.clearTimeout(timer);
      el.classList.remove("ring-2", "ring-pink-400", "ring-offset-2");
    };
  }, [scrollToBookingId, onResetScrollHighlight]);

  const renderHeader = () => (
    <div className="flex flex-col gap-4 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900">My Bookings</h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">View and manage all your facility reservations</p>
        </div>
        <button
          onClick={() => openBookingModal()}
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 text-sm sm:text-base self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Booking
        </button>
      </div>
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-pink-600 focus:ring-1 focus:ring-pink-600 focus:outline-none bg-white"
        >
          <option value="all">All Bookings</option>
          <option value="scheduled">Scheduled / Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled / Denied</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-pink-600 focus:ring-1 focus:ring-pink-600 focus:outline-none"
          />
          <label className="text-xs text-gray-500 whitespace-nowrap">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-pink-600 focus:ring-1 focus:ring-pink-600 focus:outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-pink-600 hover:text-pink-700 font-medium whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isUserBookingsLoading && userBookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        {renderHeader()}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (userBookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        {renderHeader()}
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h4>
          <p className="text-gray-600 mb-6">Create your first booking to get started with facility reservations.</p>
          <button
            onClick={() => openBookingModal()}
            className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
          >
            Create your first booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      {renderHeader()}

      {filteredBookings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 text-sm">No bookings match your filters</p>
          <button
            onClick={() => { setCategoryFilter("all"); setDateFrom(""); setDateTo(""); }}
            className="text-pink-600 hover:text-pink-700 font-medium text-sm mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBookings.map((booking, index) => {
            const status = getRenderBookingStatus(booking);
            const id = String(booking.id ?? `booking-${index}`);
            const eq = booking.equipment || {};
            const items = Array.isArray(eq.items) ? eq.items : [];
            const hasOthers = eq.others && String(eq.others).trim().length > 0;
            const isExpanded = !!expandedCards[id];

            return (
              <div
                id={`booking-${id}`}
                key={id}
                className="bg-white rounded-lg border border-gray-200 hover:border-pink-200 hover:shadow-sm transition-all duration-200 overflow-hidden"
              >
                {/* Main card row — always visible */}
                <div
                  className="p-3 sm:p-4 cursor-pointer"
                  onClick={() => toggleExpand(id)}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                    {/* Left: Facility info */}
                    <div className="flex items-start gap-2 flex-shrink-0">
                      <div className={`${
                        status.label === "Active" ? "bg-green-100" :
                        status.label === "Scheduled" ? "bg-pink-100" :
                        "bg-gray-100"
                      } p-2 rounded-lg flex-shrink-0`}>
                        <Calendar className={`h-4 w-4 ${
                          status.label === "Active" ? "text-green-600" :
                          status.label === "Scheduled" ? "text-pink-600" :
                          "text-gray-600"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm leading-tight break-words">{getFacilityDisplay(booking.facilityId)}</h4>
                        <p className="text-xs text-gray-600 mt-1 break-words">Name: {booking.name || "Not recorded"}</p>
                        <p className="text-xs text-gray-600 break-words">Program: {booking.program || "Not recorded"}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Participants:</span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{booking.participants || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Time, Status, Actions, Expand indicator */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
                      <div className="flex items-center justify-between lg:justify-start gap-3 lg:gap-6">
                        {/* Time Info */}
                        <div className="flex items-center gap-3 sm:gap-6">
                          <div className="text-left">
                            <p className="text-xs font-medium text-gray-500 mb-1">Started</p>
                            <p className="text-sm sm:text-lg font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.startTime), "h:mm a")}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(booking.startTime), "M/d/yyyy")}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-gray-500 mb-1">Ends</p>
                            <p className="text-sm sm:text-lg font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.endTime), "h:mm a")}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(booking.endTime), "M/d/yyyy")}</p>
                          </div>
                        </div>
                        {/* Status badge + Edit/Cancel buttons */}
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            status.label === "Active" ? "bg-green-100 text-green-800" :
                            status.label === "Scheduled" ? "bg-pink-100 text-pink-800" :
                            status.label === "Completed" ? "bg-green-100 text-green-800" :
                            status.label === "Cancelled" ? "bg-orange-100 text-orange-800" :
                            status.label === "Denied" ? "bg-red-100 text-red-800" :
                            status.label === "Pending" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {status.label === "Cancelled"
                              ? booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && new Date(booking.updatedAt) >= new Date(booking.arrivalConfirmationDeadline)
                                ? "Cancelled | Not Confirmed"
                                : booking.adminId
                                ? "Cancelled by Admin"
                                : "Cancelled by you"
                              : status.label}
                          </span>
                          {booking.userId === user?.id && (booking.status === 'pending' || (booking.status === 'approved' && currentTime !== null && new Date(booking.startTime).getTime() > currentTime)) && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onRescheduleBooking(booking); }}
                              className="px-2.5 py-1 text-pink-700 text-[11px] font-medium rounded-md border border-pink-200 hover:bg-pink-50 transition-colors whitespace-nowrap"
                            >
                              Reschedule
                            </button>
                          )}
                          {(canCancelBooking(booking) && booking.userId === user?.id) && (
                            <div className="flex flex-col gap-1">
                              {canCancelBooking(booking) && booking.userId === user?.id && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onCancelBooking(booking); }}
                                  disabled={cancelBookingMutationStatus === "pending"}
                                  className={`px-2.5 py-1 text-white text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                                    cancelBookingMutationStatus === "pending" ? "bg-red-400 cursor-wait" : "bg-red-600 hover:bg-red-700"
                                  }`}
                                >
                                  {cancelBookingMutationStatus === "pending" ? (
                                    <Loader2 className="h-3 w-3 animate-spin inline" />
                                  ) : (
                                    status.label === "Active" ? "End" : "Cancel"
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {/* Countdown for Active bookings */}
                      {status.label === "Active" && booking.userId === user?.id && (
                        <div className="flex-shrink-0">
                          {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed ? (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg">
                                <span className="text-[10px] font-medium text-amber-700 whitespace-nowrap">Confirm in:</span>
                                <Countdown expiry={booking.arrivalConfirmationDeadline} onExpire={() => onArrivalCountdownExpire?.(booking)} />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmArrivalMutation.mutate(String(booking.id));
                                }}
                                disabled={confirmArrivalMutation.isPending}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-wait"
                              >
                                {confirmArrivalMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                Confirm Arrival
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg">
                              <span className="text-[10px] font-medium text-green-700 whitespace-nowrap">Time left:</span>
                              <Countdown expiry={booking.endTime} onExpire={() => onActiveCountdownExpire?.(booking)} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Booked date - below the card content */}
                  <p className="text-xs text-green-600 mt-2">
                    Booked on {format(new Date(booking.createdAt || booking.startTime), "MMM d, yyyy 'at' h:mm a")}
                    {status.label === "Cancelled" && booking.updatedAt && (
                      <span className="text-red-500">
                        <span className="text-gray-900">{" | "}</span>
                        {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && new Date(booking.updatedAt) >= new Date(booking.arrivalConfirmationDeadline)
                          ? `Auto Cancelled on ${format(new Date(booking.updatedAt), "MMM d, yyyy 'at' h:mm a")}`
                          : booking.adminId
                          ? `Cancelled by Admin on ${format(new Date(booking.updatedAt), "MMM d, yyyy 'at' h:mm a")}`
                          : `Cancelled on ${format(new Date(booking.updatedAt), "MMM d, yyyy 'at' h:mm a")}`}
                      </span>
                    )}
                  </p>
                </div>

                {/* Expandable details section */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-gray-100 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Purpose */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Purpose</p>
                        <p className="text-sm text-gray-900 break-words">{booking.purpose || "No purpose specified"}</p>
                      </div>
                      {/* Equipment */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Requested Equipment</p>
                        {(items.length > 0 || hasOthers) ? (
                          <div className="space-y-1 text-left">
                            {items.map((item: string, idx: number) => (
                              <div key={`eq-${id}-${idx}`}>
                                <span className="text-xs text-gray-700 font-medium">{item}</span>
                              </div>
                            ))}
                            {hasOthers && (
                              <Popover open={!!openOthers[id]} onOpenChange={(v) => setOpenOthers((prev) => ({ ...prev, [id]: v }))}>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); }}
                                          className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                                        >
                                          View other
                                        </button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden">
                                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                        <p className="font-semibold text-sm text-gray-800">Other equipment</p>
                                      </div>
                                      <div className="p-3 max-h-48 overflow-y-auto">
                                        <p className="text-sm text-gray-900 leading-5 break-words">{String(eq.others).trim()}</p>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <PopoverContent side="top" className="max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden z-50">
                                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                    <p className="font-semibold text-sm text-gray-800">Other equipment</p>
                                  </div>
                                  <div className="p-3 max-h-48 overflow-y-auto">
                                    <p className="text-sm text-gray-900 leading-5 break-words">{String(eq.others).trim()}</p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">No equipment</p>
                        )}
                      </div>
                    </div>
                    {(booking.declineReason || booking.cancellationReason || booking.rescheduleReason || booking.equipmentRequestStatus) && (
                      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                        {booking.declineReason && <p><strong>Decline reason:</strong> {booking.declineReason}</p>}
                        {booking.cancellationReason && <p><strong>Cancellation reason:</strong> {booking.cancellationReason}</p>}
                        {booking.rescheduleReason && <p><strong>Last change reason:</strong> {booking.rescheduleReason}</p>}
                        {booking.equipmentRequestStatus && (
                          <p>
                            <strong>Equipment request:</strong> {booking.equipmentRequestStatus}
                            {booking.equipmentDeclineReason ? ` - ${booking.equipmentDeclineReason}` : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {filteredBookings.length} of {userBookings.length} bookings</p>
      </div>
    </div>
  );
}
