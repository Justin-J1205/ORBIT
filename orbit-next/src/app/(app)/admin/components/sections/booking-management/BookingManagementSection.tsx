"use client";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import { FacilityBooking } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AdminSearchBar } from "@/components/common";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUpDown, CheckCircle, ChevronLeft, ChevronRight, Clock, Eye, Loader2 } from "lucide-react";
import { ActiveBookingsTab, ScheduledBookingsTab } from './tabs';

export type MutationRef<TArg> = {
  mutate: (arg: TArg) => void;
  isPending: boolean;
};

export type BookingManagementSectionProps = {
  isAdmin: boolean;
  bookingTab: string;
  setBookingTab: Dispatch<SetStateAction<string>>;
  globalFacilityBookingSearch: string;
  setGlobalFacilityBookingSearch: Dispatch<SetStateAction<string>>;
  facilityFilter: string;
  setFacilityFilter: Dispatch<SetStateAction<string>>;
  facilitySort: "asc" | "desc";
  toggleFacilitySort: () => void;
  facilityOptions: Array<{ id: string; name: string }>;
  activeBookings: FacilityBooking[];
  upcomingBookings: FacilityBooking[];
  pendingBookings: FacilityBooking[];
  itemsPerPage: number;
  activeBookingsPage: number;
  setActiveBookingsPage: Dispatch<SetStateAction<number>>;
  upcomingBookingsPage: number;
  setUpcomingBookingsPage: Dispatch<SetStateAction<number>>;
  getNeedsStatusForBooking: (booking: FacilityBooking) => "prepared" | "not_available" | undefined;
  openPurpose: Record<string, boolean>;
  setOpenPurpose: Dispatch<SetStateAction<Record<string, boolean>>>;
  getUserEmail: (id: FacilityBooking["userId"]) => string;
  getUserRole: (id: FacilityBooking["userId"]) => string;
  getFacilityName: (id: FacilityBooking["facilityId"]) => string;
  formatDateTime: (value: FacilityBooking["startTime"]) => string;
  formatDate: (value: FacilityBooking["startTime"]) => string;
  formatTime: (value: FacilityBooking["startTime"]) => string;
  CountdownComponent: React.ComponentType<{ expiry: string | Date | undefined; onExpire?: () => void }>;
  onArrivalExpire: (booking: FacilityBooking) => void;
  onBookingEndExpire: (booking: FacilityBooking) => void;
  confirmArrivalMutation: MutationRef<{ bookingId: FacilityBooking["id"] }>;
  openEquipmentModal: (booking: FacilityBooking) => void;
  forceActiveBookingMutation: MutationRef<FacilityBooking>;
  adminBookingActionMutation: {
    mutateAsync: (input: { bookingId: string; action: string; reason?: string; startTime?: string; endTime?: string; facilityId?: number; participants?: number; purpose?: string; name?: string; program?: string }) => Promise<unknown>;
    isPending: boolean;
  };
  equipmentRequestDecisionMutation: {
    mutateAsync: (input: { bookingId: string; status: "approved" | "denied"; reason?: string }) => Promise<unknown>;
    isPending: boolean;
  };
};

export function BookingManagementSection({
  isAdmin,
  bookingTab,
  setBookingTab,
  globalFacilityBookingSearch,
  setGlobalFacilityBookingSearch,
  facilityFilter,
  setFacilityFilter,
  facilitySort,
  toggleFacilitySort,
  facilityOptions,
  activeBookings,
  upcomingBookings,
  pendingBookings,
  itemsPerPage,
  activeBookingsPage,
  setActiveBookingsPage,
  upcomingBookingsPage,
  setUpcomingBookingsPage,
  getNeedsStatusForBooking,
  openPurpose,
  setOpenPurpose,
  getUserEmail,
  getUserRole,
  getFacilityName,
  formatDateTime,
  formatDate,
  formatTime,
  CountdownComponent,
  onArrivalExpire,
  onBookingEndExpire,
  confirmArrivalMutation,
  openEquipmentModal,
  forceActiveBookingMutation,
  adminBookingActionMutation,
  equipmentRequestDecisionMutation,
}: BookingManagementSectionProps) {
  const bookingSearchTerm = globalFacilityBookingSearch.trim().toLowerCase();

  const activeBookingsFiltered = useMemo(() => {
    if (!bookingSearchTerm) return activeBookings;
    return activeBookings.filter((booking) => {
      const haystack = [
        getUserEmail(booking.userId),
        getFacilityName(booking.facilityId),
        booking.name,
        booking.program,
        booking.purpose,
        booking.status,
        String(booking.participants ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(bookingSearchTerm);
    });
  }, [activeBookings, bookingSearchTerm, getFacilityName, getUserEmail]);

  const upcomingBookingsFiltered = useMemo(() => {
    if (!bookingSearchTerm) return upcomingBookings;
    return upcomingBookings.filter((booking) => {
      const haystack = [
        getUserEmail(booking.userId),
        getFacilityName(booking.facilityId),
        booking.name,
        booking.program,
        booking.purpose,
        booking.status,
        String(booking.participants ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(bookingSearchTerm);
    });
  }, [upcomingBookings, bookingSearchTerm, getFacilityName, getUserEmail]);

  const scheduledBadgeTotal = useMemo(() => {
    if (bookingSearchTerm) return upcomingBookingsFiltered.length;
    const upcomingCount = upcomingBookings.length;
    const pendingCount = pendingBookings.length;
    return upcomingCount + pendingCount;
  }, [bookingSearchTerm, pendingBookings.length, upcomingBookings.length, upcomingBookingsFiltered.length]);

  if (bookingSearchTerm) {
    const activeCount = activeBookingsFiltered.length;
    const scheduledCount = upcomingBookingsFiltered.length;
    if (bookingTab === "active" && activeCount === 0 && scheduledCount > 0) {
      setBookingTab("pendingList");
    } else if (bookingTab === "pendingList" && scheduledCount === 0 && activeCount > 0) {
      setBookingTab("active");
    }
  }

  const renderPurposeButton = (booking: FacilityBooking, idPrefix: string, triggerClass?: string) => {
    if (!booking.purpose) return null;
    const id = `${idPrefix}-${booking.id}`;
    const isOpen = !!openPurpose[id];
    return (
      <Popover open={isOpen} onOpenChange={(value) => setOpenPurpose((prev) => ({ ...prev, [id]: value }))}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  onClick={() => setOpenPurpose((prev) => ({ ...prev, [id]: !prev[id] }))}
                  className={
                    triggerClass || "inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 transition-colors"
                  }
                  aria-expanded={isOpen}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="text-xs">Purpose</span>
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p className="font-semibold text-sm text-gray-800 text-left">Purpose</p>
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-900 leading-5 break-words text-left">
                  {booking.purpose || "No purpose specified"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent side="top" align="end" className="max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden z-50">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <p className="font-semibold text-sm text-gray-800 text-left">Purpose</p>
          </div>
          <div className="p-3">
            <p className="text-sm text-gray-900 leading-5 break-words text-left">
              {booking.purpose || "No purpose specified"}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderEquipmentLine = (booking: FacilityBooking) => {
    if (!booking.equipment) return null;
    
    try {
      const equipment = booking.equipment;
      const items: { label: string; isOther: boolean; otherValue?: string }[] = [];
      
      if (typeof equipment === 'object' && equipment !== null) {
        // Handle new format with items array
        if (Array.isArray((equipment as any).items)) {
          (equipment as any).items.forEach((item: string) => {
            const displayKey = item
              .split("_")
              .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
              .join(" ");
            items.push({ label: displayKey, isOther: false });
          });
        } else {
          // Handle legacy format (flat object)
          Object.entries(equipment).forEach(([key, value]) => {
            if (key === 'others') {
              // Skip 'others' here, will add it at the end
            } else if (value === true || value === 'prepared' || value === 'requested') {
              const displayKey = key
                .split("_")
                .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
                .join(" ");
              items.push({ label: displayKey, isOther: false });
            }
          });
        }
        
        // Handle "others" field (works for both formats)
        if ((equipment as any).others) {
          items.push({ label: String((equipment as any).others), isOther: true, otherValue: String((equipment as any).others) });
        }
      }
      
      if (items.length === 0) return null;
      
      // Parse equipment statuses from adminResponse
      const getItemStatus = (itemLabel: string): string => {
        // Check if booking is active and equipment hasn't been checked
        const now = new Date();
        const startTime = new Date(booking.startTime);
        const endTime = new Date(booking.endTime);
        const isActive = startTime <= now && now <= endTime;
        const equipmentChecked = hasEquipmentBeenChecked(booking);
        
        // If booking is active and equipment was never checked, mark as not available
        if (isActive && !equipmentChecked) {
          return 'not_available';
        }
        
        try {
          const resp = String(booking?.adminResponse || '');
          const jsonMatch = resp.match(/\{"items":\{[^}]*\}\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.items && typeof parsed.items === 'object') {
              const itemKey = String(itemLabel).toLowerCase().replace(/\s+/g, '_');
              for (const [key, value] of Object.entries(parsed.items)) {
                const normalizedKey = String(key).toLowerCase().replace(/\s+/g, '_');
                if (normalizedKey === itemKey || String(key).toLowerCase() === String(itemLabel).toLowerCase()) {
                  return String(value);
                }
              }
            }
          }
        } catch (e) {
          // If parsing fails, return pending
        }
        return 'pending';
      };
      
      return (
        <>
          {items.map((item, idx) => {
            const statusValue = getItemStatus(item.label);
            return (
              <div key={idx} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-900 font-medium">
                    {item.isOther ? '' : item.label.toLowerCase()}
                  </span>
                  {item.isOther && item.otherValue && (
                    <Popover>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                                className="text-xs text-pink-600 hover:text-pink-700 font-medium transition-colors ml-1"
                              >
                                View other
                              </button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[90vw] sm:max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-200">
                              <p className="font-semibold text-xs sm:text-sm text-gray-800">Other equipment</p>
                            </div>
                            <div className="p-3 max-h-48 overflow-y-auto">
                              <p className="text-xs sm:text-sm text-gray-900 leading-5 break-words">{item.otherValue}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <PopoverContent side="top" className="max-w-[90vw] sm:max-w-sm p-0 bg-white border border-gray-300 shadow-xl rounded-lg overflow-hidden z-50">
                        <div className="bg-gray-50 px-3 sm:px-4 py-2 border-b border-gray-200">
                          <p className="font-semibold text-xs sm:text-sm text-gray-800">Other equipment</p>
                        </div>
                        <div className="p-3 max-h-48 overflow-y-auto">
                          <p className="text-xs sm:text-sm text-gray-900 leading-5 break-words">{item.otherValue}</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    statusValue === 'prepared'
                      ? 'bg-green-100 text-green-700'
                      : statusValue === 'not_available' || statusValue === 'not available'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusValue === 'not_available' ? 'not available' : statusValue}
                </span>
              </div>
            );
          })}
        </>
      );
    } catch (e) {
      return null;
    }
  };

  const hasEquipmentBeenChecked = (booking: FacilityBooking): boolean => {
    try {
      const resp = String(booking?.adminResponse || '');
      const jsonMatch = resp.match(/\{"items":\{[^}]*\}\}/);
      return !!jsonMatch;
    } catch (e) {
      return false;
    }
  };

  const renderNeedsBadge = (booking: FacilityBooking) => {
    if (!booking.equipment) return null;
    const status = getNeedsStatusForBooking(booking);
    if (status === "prepared") {
      return (
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
          Prepared
        </span>
      );
    }
    if (status === "not_available") return null;
    return (
      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        NEEDS
      </span>
    );
  };

  const renderCountBadge = (label: string, value: React.ReactNode, className: string, title?: string) => (
    <div
      className={className}
      title={title}
    >
      {value} {label}
    </div>
  );

  const renderPagination = (
    totalItems: number,
    page: number,
    setPage: Dispatch<SetStateAction<number>>,
  ) => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200">
      <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
        Showing {page * itemsPerPage + 1} to {Math.min((page + 1) * itemsPerPage, totalItems)} of {totalItems} results
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
          disabled={page === 0}
          className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 py-1 text-xs sm:text-sm font-medium whitespace-nowrap">
          {page + 1} of {Math.ceil(totalItems / itemsPerPage)}
        </span>
        <button
          onClick={() =>
            setPage((prev) => ((prev + 1) * itemsPerPage < totalItems ? prev + 1 : prev))
          }
          disabled={(page + 1) * itemsPerPage >= totalItems}
          className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
            <div className="flex-1 min-w-0">
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Facility Booking Management</h2>
                <p className="text-sm sm:text-base text-gray-600">
                  Monitor active bookings, scheduled reservations, and booking history
                </p>
                <AdminSearchBar
                  value={globalFacilityBookingSearch}
                  onChange={(value) => {
                    setGlobalFacilityBookingSearch(value);
                    setActiveBookingsPage(0);
                    setUpcomingBookingsPage(0);
                  }}
                  placeholder="Search bookings..."
                  ariaLabel="Facility bookings search"
                  className="pt-1"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-row flex-wrap gap-2 items-center">
                {renderCountBadge(
                  "Active",
                  bookingSearchTerm
                    ? `${activeBookingsFiltered.length || 0}/${activeBookings.length || 0}`
                    : activeBookings.length || 0,
                  "bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap text-center",
                  bookingSearchTerm ? `${activeBookingsFiltered.length || 0}/${activeBookings.length || 0}` : undefined,
                )}
                {renderCountBadge(
                  "Scheduled",
                  bookingSearchTerm
                    ? `${upcomingBookingsFiltered.length || 0}/${upcomingBookings.length || 0}`
                    : scheduledBadgeTotal,
                  "bg-pink-100 text-pink-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap text-center",
                  bookingSearchTerm ? `${upcomingBookingsFiltered.length || 0}/${upcomingBookings.length || 0}` : undefined,
                )}
              </div>
              <div className="flex flex-row gap-2">
                <Select
                  value={facilityFilter}
                  onValueChange={(value) => {
                    setFacilityFilter(value);
                    setActiveBookingsPage(0);
                    setUpcomingBookingsPage(0);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All facilities</SelectItem>
                    {facilityOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={toggleFacilitySort}
                  className="inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
                  aria-label="Toggle facility sort order"
                >
                  <span className="mr-2">{facilitySort === "asc" ? "A → Z" : "Z → A"}</span>
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={bookingTab} onValueChange={(value) => setBookingTab(value)} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 gap-2">
            <TabsTrigger value="active" className="w-full whitespace-normal flex items-center justify-start md:justify-center gap-2 text-left md:text-center">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Active Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="pendingList" className="w-full whitespace-normal flex items-center justify-start md:justify-center gap-2 text-left md:text-center">
              <Clock className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Scheduled</span>
            </TabsTrigger>
          </TabsList>

          {/* Active bookings extracted into component */}
          <TabsContent value="active" className="space-y-4 mt-6 md:mt-0">
            <ActiveBookingsTab
              bookingSearchTerm={bookingSearchTerm}
              activeBookingsFiltered={activeBookingsFiltered}
              activeBookings={activeBookings}
              activeBookingsPage={activeBookingsPage}
              setActiveBookingsPage={setActiveBookingsPage}
              itemsPerPage={itemsPerPage}
              getUserEmail={getUserEmail}
              getUserRole={getUserRole}
              getFacilityName={getFacilityName}
              formatTime={formatTime}
              formatDate={formatDate}
              renderPurposeButton={renderPurposeButton}
              renderEquipmentLine={renderEquipmentLine}
              isAdmin={isAdmin}
              equipmentRequestDecisionMutation={equipmentRequestDecisionMutation}
              openEquipmentModal={openEquipmentModal}
              getNeedsStatusForBooking={getNeedsStatusForBooking}
              hasEquipmentBeenChecked={hasEquipmentBeenChecked}
              onArrivalExpire={onArrivalExpire}
              confirmArrivalMutation={confirmArrivalMutation}
              onBookingEndExpire={onBookingEndExpire}
              CountdownComponent={CountdownComponent}
              renderPagination={renderPagination}
            />
          </TabsContent>

          {/* Scheduled bookings extracted into component */}
          <TabsContent value="pendingList" className="space-y-4 mt-6 md:mt-0">
            <ScheduledBookingsTab
              bookingSearchTerm={bookingSearchTerm}
              upcomingBookingsFiltered={upcomingBookingsFiltered}
              upcomingBookings={upcomingBookings}
              upcomingBookingsPage={upcomingBookingsPage}
              setUpcomingBookingsPage={setUpcomingBookingsPage}
              itemsPerPage={itemsPerPage}
              getUserEmail={getUserEmail}
              getUserRole={getUserRole}
              getFacilityName={getFacilityName}
              formatDateTime={formatDateTime}
              formatTime={formatTime}
              formatDate={formatDate}
              renderPurposeButton={renderPurposeButton}
              renderEquipmentLine={renderEquipmentLine}
              renderNeedsBadge={renderNeedsBadge}
              isAdmin={isAdmin}
              forceActiveBookingMutation={forceActiveBookingMutation}
              adminBookingActionMutation={adminBookingActionMutation}
              equipmentRequestDecisionMutation={equipmentRequestDecisionMutation}
              renderPagination={renderPagination}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
