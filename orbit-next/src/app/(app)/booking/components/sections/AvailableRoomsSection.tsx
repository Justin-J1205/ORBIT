import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { isFacilityAllowedForRole } from "@shared/facilityAccess";

import { SkeletonFacilityCard } from "@/components/ui/skeleton-presets";

interface AvailableRoomsSectionProps {
  user: any;
  facilities: any[];
  isFacilitiesLoading: boolean;
  isFacilitiesFetching: boolean;
  availabilityMap: Map<number, any>;
  unavailableDatesByFacility: Record<string, string[]>;
  getFacilityBookingStatus: (facilityId: number) => {
    status: string;
    label: string;
    badgeClass: string;
    booking: any;
  };
  getFacilityDescriptionByName: (name?: string) => string;
  getFacilityImageByName: (name?: string) => string;
  formatFacilityName: (name: string) => string;
  isRestrictedFacility: (facility: any) => boolean;
  isLibraryClosedNow: () => boolean;
  devForceOpen: boolean;
  setDevForceOpen: Dispatch<SetStateAction<boolean>>;
  openBookingModal: (facilityId?: number, start?: Date, end?: Date) => void;
  setSelectedFacilityForBooking: (facilityId: number | null) => void;
  setInitialStartForBooking: (date: Date | null) => void;
  setInitialEndForBooking: (date: Date | null) => void;
  setInitialTimesAreSuggested: (value: boolean) => void;
  toast: (args: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  variant?: "dashboard" | "full";
  className?: string;
  showAvailabilityGrid?: boolean;
}

const FacilityStatusBadge = ({
  facility,
  bookingStatus,
}: {
  facility: any;
  bookingStatus: { status: string; label: string; booking?: any };
}) => {
  if (!facility.isActive) {
    return <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-red-500 text-white">Temporarily Unavailable</span>;
  }
  // Show Pending if booking exists and is not yet confirmed
  if (bookingStatus.booking?.status === "pending") {
    return <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-amber-500 text-white">Pending</span>;
  }
  if (bookingStatus.status === "booked") {
    return <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-red-500 text-white">In Use</span>;
  }
  if (bookingStatus.status === "pending") {
    return <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-amber-500 text-white">Pending</span>;
  }
  return null;
};

export function AvailableRoomsSection({
  user,
  facilities,
  isFacilitiesLoading,
  isFacilitiesFetching,
  availabilityMap,
  unavailableDatesByFacility,
  getFacilityBookingStatus,
  getFacilityDescriptionByName,
  getFacilityImageByName,
  formatFacilityName,
  isLibraryClosedNow,
  devForceOpen,
  setDevForceOpen,
  openBookingModal,
  setSelectedFacilityForBooking,
  setInitialStartForBooking,
  setInitialEndForBooking,
  setInitialTimesAreSuggested,
  toast,
  variant = "full",
  className,
  showAvailabilityGrid = true,
}: AvailableRoomsSectionProps) {
  const { data: campusList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campuses");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);

  // Auto-select first campus when list loads
  useEffect(() => {
    if (campusList.length > 0 && selectedCampusId === null) {
      setSelectedCampusId(campusList[0].id);
    }
  }, [campusList, selectedCampusId]);

  const roleFilteredFacilities = useMemo(() => {
    const userRole = user?.role || "student";
    return facilities.filter((facility) => isFacilityAllowedForRole(facility, userRole));
  }, [facilities, user?.role]);

  const filteredFacilities = useMemo(() => {
    if (selectedCampusId === null) return roleFilteredFacilities;
    return roleFilteredFacilities.filter((facility) => facility.campusId === selectedCampusId);
  }, [roleFilteredFacilities, selectedCampusId]);

  const campusCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const campus of campusList) {
      counts[campus.id] = 0;
    }
    for (const facility of roleFilteredFacilities) {
      if (facility.campusId && counts[facility.campusId] !== undefined) {
        counts[facility.campusId] += 1;
      }
    }
    return counts;
  }, [roleFilteredFacilities, campusList]);

  // Removed effect that auto-switches campus if none available, so user can see empty state

  const handleOpenBooking = (facility: any, start?: Date, end?: Date) => {
    const userRole = user?.role || "student";

    if (!isFacilityAllowedForRole(facility, userRole)) {
      toast({
        title: "Access Restricted",
        description: "Your account does not have permission to book this facility.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFacilityForBooking(facility.id);
    setInitialStartForBooking(start ?? null);
    setInitialEndForBooking(end ?? null);
    setInitialTimesAreSuggested(Boolean(start && end));
    openBookingModal(facility.id, start, end);
  };

  // Track loading state for booking button
  const [loadingFacilityId, setLoadingFacilityId] = useState<number | null>(null);

  const renderFacilityCard = (facility: any) => {
    const bookingStatus = getFacilityBookingStatus(facility.id);
    const isAvailableForBooking = facility.isActive && (bookingStatus.status === "available" || bookingStatus.status === "closed");
    // Allow booking request if facility is active (regardless of current booking status)
    const canRequestBooking = facility.isActive;

    // Check if it's within library hours
    const isLibraryClosed = isLibraryClosedNow();
    // Show badge if not active, or if there is a booking (pending or booked)
    const showBadge = !facility.isActive || bookingStatus.booking;

    // Only allow click if available for booking or library is closed (for request)
    const isCardClickable = isAvailableForBooking || isLibraryClosed;

    // Button loading handler
    const handleBookingClick = (event: any) => {
      event.stopPropagation();
      if (!canRequestBooking) return;
      setLoadingFacilityId(facility.id);
      // Simulate async modal open (if openBookingModal is async, handle promise)
      Promise.resolve(openBookingModal(facility.id)).finally(() => {
        setLoadingFacilityId(null);
      });
    };

    return (
      <div
        key={facility.id}
        className={`group bg-white border rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full max-w-sm w-full mx-auto sm:max-w-none ${
          isAvailableForBooking
            ? "border-gray-200 hover:shadow-lg cursor-pointer hover:border-pink-200"
            : isLibraryClosed
              ? "border-amber-200 hover:shadow-md cursor-pointer hover:border-amber-300 bg-amber-50/30"
              : "border-gray-200 hover:shadow-lg cursor-not-allowed hover:border-pink-200"
        }`}
      >

        <div className="aspect-video bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center relative max-h-[140px] sm:max-h-[200px]">
          {showBadge && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <FacilityStatusBadge facility={facility} bookingStatus={bookingStatus} />

            </div>
          )}
          {(() => {
            let image = "";
            if (facility.image) {
              if (/^https?:\/\//.test(facility.image)) {
                image = facility.image;
              } else if (facility.image.startsWith("/images/")) {
                image = facility.image;
              } else {
                image = `/images/${facility.image}`;
              }
            } else if (facility.imageUrl) {
              image = facility.imageUrl;
            } else {
              image = getFacilityImageByName(facility.name);
            }

            if (!image) {
              return (
                <div className="text-center">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-1.5 shadow-sm">
                    <Calendar className={`h-5 w-5 sm:h-7 sm:w-7 ${isAvailableForBooking ? "text-gray-400" : "text-gray-300"}`} />
                  </div>
                  <p className={`text-xs sm:text-sm ${isAvailableForBooking ? "text-gray-500" : "text-gray-400"}`}>No image</p>
                </div>
              );
            }

            return (
              <div className="absolute inset-0 w-full h-full">
                <img
                  src={image}
                  alt={facility.name}
                  className={`w-full h-full object-cover transition-transform duration-300 ${isAvailableForBooking ? "group-hover:scale-105" : "group-hover:scale-105 opacity-85"}`}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </div>
            );
          })()}
        </div>

        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3
              className={`font-bold text-sm sm:text-base leading-tight transition-colors truncate ${
                isAvailableForBooking ? "text-black-900 group-hover:text-pink-700" : "text-gray-500"
              }`}
            >
              {formatFacilityName(facility.name)}
            </h3>
            {showBadge && (
              <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                !facility.isActive
                  ? "bg-red-100 text-red-800"
                  : bookingStatus.status === "booked"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
              }`}>
                {!facility.isActive
                  ? "Temporarily unavailable"
                  : bookingStatus.status === "booked"
                    ? "In Use"
                    : "Pending"}
              </span>
            )}
          </div>



          <p className={`text-xs sm:text-sm leading-relaxed mb-2 flex-grow line-clamp-2 ${isAvailableForBooking ? "text-black-600" : "text-gray-500"}`}>
            {facility.description || "No description provided."}
          </p>

                    {!facility.isActive && (
            <div className="mb-2 p-2 rounded-md border bg-red-50 border-red-100">

              <div className="text-[11px] font-bold uppercase text-red-700 mb-1 tracking-wide">Admin Note</div>
              {facility.unavailableReason && (
                <div className="text-xs sm:text-sm text-red-700">{facility.unavailableReason}</div>
              )}
            </div>
          )}

          {bookingStatus.booking && (user?.role === "admin" || bookingStatus.booking?.userId === user?.id) && (
            <>
              {bookingStatus.status === "booked" && (
                <div className="mb-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5">In use until:</p>
                  <p className="text-xs sm:text-sm text-gray-900 font-medium">
                    {new Date(bookingStatus.booking.endTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              )}
              {bookingStatus.booking?.status === "pending" && bookingStatus.status !== "booked" && (
                <div className="mb-2 p-2 bg-amber-50 rounded-md border border-amber-100">
                  <p className="text-[10px] sm:text-xs font-medium text-amber-800 mb-0.5">Pending:</p>
                  <p className="text-xs sm:text-sm text-gray-900 font-medium">
                    {`${format(new Date(bookingStatus.booking.startTime), "MMM d")} • ${format(new Date(bookingStatus.booking.startTime), "h:mm a")} - ${format(new Date(bookingStatus.booking.endTime), "h:mm a")}`}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Awaiting arrival confirmation.</p>
                </div>
              )}
            </>
          )}

          <div className="mt-auto">

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isAvailableForBooking ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={`text-xs sm:text-sm font-medium ${isAvailableForBooking ? "text-green-700" : "text-gray-500"}`}>
                  {`Up to ${facility.capacity || 8}`}
                </span>
              </div>

              <button
                onClick={handleBookingClick}
                disabled={!canRequestBooking || loadingFacilityId === facility.id}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors duration-200 shadow-sm flex-shrink-0 ${
                  !facility.isActive
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : isAvailableForBooking
                      ? "bg-pink-600 hover:bg-pink-700 text-white shadow-md"
                      : isLibraryClosed
                        ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                        : "bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200"
                }`}
              >
                {loadingFacilityId === facility.id ? (
                  <span className="flex items-center gap-1 justify-center">
                    <svg className="animate-spin h-4 w-4 mr-1 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : (
                  !facility.isActive ? "Unavailable" : isAvailableForBooking ? "Book Now" : isLibraryClosed ? "Request" : "Book Now"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const availableRooms = useMemo(() => {
    return filteredFacilities.filter((facility) => facility.isActive && getFacilityBookingStatus(facility.id).status === "available");
  }, [filteredFacilities, getFacilityBookingStatus]);

  return (
    <section className={className}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Available Study Rooms</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Browse and book available facilities</p>


            <div className="mt-3 inline-flex flex-wrap p-1 rounded-lg bg-gray-100 border border-gray-200">
              {campusList.map((campus) => (
                <button
                  key={campus.id}
                  type="button"
                  onClick={() => setSelectedCampusId(campus.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedCampusId === campus.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {campus.name} ({campusCounts[campus.id] ?? 0})
                </button>
              ))}
            </div>
          </div>

          {/* {variant === "full" && (
            <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
              {process.env.NODE_ENV !== "production" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:justify-end">
                  <label className="text-xs text-gray-600">Dev: Force Open</label>
                  <button
                    onClick={() => setDevForceOpen((previous) => !previous)}
                    className={`px-2 py-1 rounded text-sm ${devForceOpen ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    {devForceOpen ? "ON" : "OFF"}
                  </button>
                </div>
              )}
            </div>
          )} */}
        </div>

                {!isFacilitiesLoading && !isFacilitiesFetching && filteredFacilities.length > 0 && availableRooms.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
            {isLibraryClosedNow() ? (
              <>
                <h4 className="text-lg font-medium text-gray-900 mb-2">School Closed</h4>
                <p className="text-gray-600">School operating hours (7:30 AM - 7:00 PM). Room access is only available during these hours.</p>
              </>
            ) : (
              <>
                <h4 className="text-lg font-medium text-gray-900 mb-2">All rooms are currently booked</h4>
                <p className="text-gray-600">All facilities are currently in use, scheduled, or otherwise unavailable. Please check back later or contact school staff for assistance.</p>
              </>
            )}
          </div>
        )}


        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {(isFacilitiesLoading || isFacilitiesFetching)
            ? Array.from({ length: 6 }).map((_, index) => <SkeletonFacilityCard key={index} />)
            : filteredFacilities.map(renderFacilityCard)}
        </div>

        {!isFacilitiesLoading && !isFacilitiesFetching && filteredFacilities.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No facilities available</h4>
            <p className="text-gray-600">
              {`No facilities found for the ${campusList.find((c) => c.id === selectedCampusId)?.name ?? "selected campus"}.`}
            </p>
          </div>
        )}



      </div>
    </section>
  );
}
