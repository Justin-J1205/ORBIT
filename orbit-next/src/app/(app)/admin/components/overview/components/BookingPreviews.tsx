import React, { useState } from "react";
import { Calendar, ArrowUpDown, Eye } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FacilityBooking } from "@shared/schema";
import type { BookingPreviewsProps } from "../../admin/types";
import { EmptyState } from "./EmptyState";

export function BookingPreviews({ upcomingBookings, recentBookings, scheduledCount, facilityFilter, setFacilityFilter, facilitySort, setFacilitySort, facilityOptions, getFacilityName, getUserEmail, formatDateTime, renderStatusBadge, onNavigateToBookingManagement, onNavigateToActivityLogs }: BookingPreviewsProps) {
  const [selectedBooking, setSelectedBooking] = useState<FacilityBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBookingClick = (booking: FacilityBooking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBooking(null);
  };

  const renderEquipmentSection = (booking: FacilityBooking) => {
    if (!booking.equipment || typeof booking.equipment !== 'object') return null;

    const equipment = booking.equipment as any;
    const items = Array.isArray(equipment.items) ? equipment.items : [];
    const hasOthers = equipment.others && String(equipment.others).trim().length > 0;

    if (items.length === 0 && !hasOthers) return null;

    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Equipment</h3>
        <div className="space-y-2">
          {items.map((item: string, idx: number) => {
            let statusValue = "pending";
            try {
              const resp = String(booking?.adminResponse || "");
              const jsonMatch = resp.match(/\{"items":\{[^}]*\}\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.items && typeof parsed.items === "object") {
                  const itemKey = String(item).toLowerCase().replace(/\s+/g, "_");
                  for (const [key, value] of Object.entries(parsed.items)) {
                    const normalizedKey = String(key).toLowerCase().replace(/\s+/g, "_");
                    if (normalizedKey === itemKey || String(key).toLowerCase() === String(item).toLowerCase()) {
                      statusValue = String(value);
                      break;
                    }
                  }
                }
              }
            } catch {}

            return (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-700 font-medium">{item}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  statusValue === "prepared" ? "bg-green-100 text-green-700" :
                  statusValue === "not_available" || statusValue === "not available" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {statusValue === "not_available" ? "not available" : statusValue}
                </span>
              </div>
            );
          })}
          {hasOthers && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-1">Other Equipment</h4>
              <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded">{equipment.others}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col">
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Scheduled Bookings</h3>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Upcoming approved and auto-scheduled reservations</p>
            </div>
            <div className="bg-pink-100 text-pink-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium self-start whitespace-nowrap">{scheduledCount || 0} scheduled</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilityOptions.map(option => (<SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <button onClick={() => setFacilitySort(prev => (prev === 'asc' ? 'desc' : 'asc'))} className="inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted" aria-label="Toggle facility sort order">
              <span className="mr-2">{facilitySort === 'asc' ? 'A → Z' : 'Z → A'}</span>
              <ArrowUpDown className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {upcomingBookings && upcomingBookings.length > 0 ? (
          <>
            <div className="space-y-3 flex-1">
              {upcomingBookings.slice(0, 5).map((booking) => (
                <div key={booking.id} onClick={() => handleBookingClick(booking)} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 hover:shadow-sm transition-all duration-200 cursor-pointer">
                {/* Mobile layout */}
                <div className="flex flex-col gap-3 md:hidden">
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                      <Calendar className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{getFacilityName(booking.facilityId)}</h4>
                      <p className="text-xs text-gray-500 truncate">{getUserEmail(booking.userId)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="text-xs font-medium text-gray-500">Started</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.startTime), "h:mm a")}</p>
                        <p className="text-xs text-gray-500">{format(new Date(booking.startTime), "M/d/yyyy")}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-gray-500">Ends</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.endTime), "h:mm a")}</p>
                        <p className="text-xs text-gray-500">{format(new Date(booking.endTime), "M/d/yyyy")}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">{renderStatusBadge(booking.status)}</div>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                      <Calendar className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{getFacilityName(booking.facilityId)}</h4>
                      <p className="text-xs text-gray-500 truncate">{getUserEmail(booking.userId)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-left">
                      <p className="text-xs font-medium text-gray-500">Started</p>
                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.startTime), "h:mm a")}</p>
                      <p className="text-xs text-gray-500">{format(new Date(booking.startTime), "M/d/yyyy")}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-gray-500">Ends</p>
                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.endTime), "h:mm a")}</p>
                      <p className="text-xs text-gray-500">{format(new Date(booking.endTime), "M/d/yyyy")}</p>
                    </div>
                    
                    <div className="flex-shrink-0">{renderStatusBadge(booking.status)}</div>
                  </div>
                </div>
              </div>
              ))}
            </div>
            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => onNavigateToBookingManagement('pendingList')} className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 transition-colors duration-150">View All</button>
            </div>
          </>
        ) : (
          <EmptyState Icon={Calendar} message="No scheduled bookings" />
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">Recent Booking History</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">A quick preview of the most recent booking records</p>
          </div>
          <div className="bg-pink-100 text-pink-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium self-start whitespace-nowrap">{recentBookings?.length || 0} records</div>
        </div>

        {recentBookings && recentBookings.length > 0 ? (
          <>
            <div className="space-y-3">
              {recentBookings.slice(0, 5).map((booking: FacilityBooking) => {
              const actionTime = booking.createdAt || booking.startTime;
              let statusLabel = String(booking.status || '').toLowerCase();
              if (statusLabel === 'approved') {
                try { if (new Date(booking.endTime) < new Date()) statusLabel = 'Completed'; else statusLabel = 'Approved'; } catch { statusLabel = 'Approved'; }
              } else if (statusLabel === 'denied') statusLabel = 'Denied';
              else if (statusLabel === 'cancelled' || statusLabel === 'canceled') statusLabel = 'Cancelled';
              else if (statusLabel === 'expired' || statusLabel === 'void') statusLabel = 'Expired';
              else statusLabel = booking.status || 'Unknown';

              return (
                <div
                  key={booking.id}
                  onClick={() => handleBookingClick(booking)}
                  className="bg-white rounded-lg p-3 border border-gray-200 hover:border-pink-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
                >
                  {/* Mobile layout */}
                  <div className="flex flex-col gap-3 md:hidden">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{getFacilityName(booking.facilityId)}</h4>
                        <p className="text-xs text-gray-500 truncate">{getUserEmail(booking.userId)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className="text-xs font-medium text-gray-500">Started</p>
                          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.startTime), "h:mm a")}</p>
                          <p className="text-xs text-gray-500">{format(new Date(booking.startTime), "M/d/yyyy")}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium text-gray-500">Ends</p>
                          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.endTime), "h:mm a")}</p>
                          <p className="text-xs text-gray-500">{format(new Date(booking.endTime), "M/d/yyyy")}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">{renderStatusBadge(statusLabel)}</div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
                    {/* Left section: Facility info */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                        <Calendar className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{getFacilityName(booking.facilityId)}</h4>
                        <p className="text-xs text-gray-500 truncate">
                          {getUserEmail(booking.userId)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Right section: Time & Status */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Time Info */}
                      <div className="text-left">
                        <p className="text-xs font-medium text-gray-500">Started</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.startTime), "h:mm a")}</p>
                        <p className="text-xs text-gray-500">{format(new Date(booking.startTime), "M/d/yyyy")}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-gray-500">Ends</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{format(new Date(booking.endTime), "h:mm a")}</p>
                        <p className="text-xs text-gray-500">{format(new Date(booking.endTime), "M/d/yyyy")}</p>
                      </div>
                      
                      {/* Status */}
                      <div className="flex-shrink-0">{renderStatusBadge(statusLabel)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => onNavigateToActivityLogs('history')} className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700 transition-colors duration-150">View All</button>
            </div>
          </>
        ) : (
          <EmptyState Icon={Calendar} message="No recent booking activity" />
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Facility</h3>
                <p className="text-base text-gray-900">{getFacilityName(selectedBooking.facilityId)}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">User</h3>
                <p className="text-base text-gray-900">{getUserEmail(selectedBooking.userId)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Name</h3>
                  <p className="text-base text-gray-900">{selectedBooking.name || "Not recorded"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Program</h3>
                  <p className="text-base text-gray-900">{selectedBooking.program || "Not recorded"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Start Time</h3>
                  <p className="text-base text-gray-900">{format(new Date(selectedBooking.startTime), "PPpp")}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">End Time</h3>
                  <p className="text-base text-gray-900">{format(new Date(selectedBooking.endTime), "PPpp")}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  selectedBooking.status === "approved" ? "bg-green-100 text-green-800" :
                  selectedBooking.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                  selectedBooking.status === "denied" ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {selectedBooking.status || "Unknown"}
                </span>
              </div>
              {selectedBooking.purpose && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Purpose</h3>
                  <p className="text-base text-gray-900 whitespace-pre-wrap">{selectedBooking.purpose}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Participants</h3>
                <p className="text-base text-gray-900">{selectedBooking.participants || 0}</p>
              </div>
              {renderEquipmentSection(selectedBooking)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
