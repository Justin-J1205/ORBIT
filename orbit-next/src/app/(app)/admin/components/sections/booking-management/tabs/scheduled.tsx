import React, { useState } from 'react';
import { FacilityBooking } from '@shared/schema';
import { ChevronDown, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ACADEMIC_PROGRAM_OPTIONS } from "@shared/bookingRules";
import { getManilaDateTimeInputs, manilaDateTimeToIso } from "@/shared/manilaDateTime";
import { EquipmentApprovalPanel } from "../EquipmentApprovalPanel";
import { getEquipmentRequestStatusLabel } from "@admin/lib/equipment";

export const BOOKING_MANAGEMENT_TAB_SCHEDULED = 'pendingList' as const;

export type ScheduledBookingsTabProps = {
  bookingSearchTerm: string;
  upcomingBookingsFiltered: FacilityBooking[];
  upcomingBookings: FacilityBooking[];
  upcomingBookingsPage: number;
  setUpcomingBookingsPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  getUserEmail: (id: FacilityBooking['userId']) => string;
  getUserRole: (id: FacilityBooking['userId']) => string;
  getFacilityName: (id: FacilityBooking['facilityId']) => string;
  formatDateTime: (value: FacilityBooking['startTime']) => string;
  formatTime: (value: FacilityBooking['startTime']) => string;
  formatDate: (value: FacilityBooking['startTime']) => string;
  renderPurposeButton: (booking: FacilityBooking, idPrefix: string, triggerClass?: string) => React.ReactNode;
  renderEquipmentLine: (booking: FacilityBooking) => React.ReactNode;
  renderNeedsBadge: (booking: FacilityBooking) => React.ReactNode;
  isAdmin: boolean;
  forceActiveBookingMutation: {
    mutateAsync: (input: { booking: FacilityBooking; reason: string }) => Promise<unknown>;
    isPending: boolean;
  };
  adminBookingActionMutation: {
    mutateAsync: (input: { bookingId: string; action: string; reason?: string; startTime?: string; endTime?: string; facilityId?: number; participants?: number; purpose?: string; name?: string; program?: string }) => Promise<unknown>;
    isPending: boolean;
  };
  equipmentRequestDecisionMutation: {
    mutateAsync: (input: {
      bookingId: string;
      itemKey: string;
      status: "approved" | "declined";
      reason?: string;
    }) => Promise<{ success: boolean; itemStatus: "approved" | "declined"; equipmentRequestStatus: string }>;
    isPending: boolean;
  };
  renderPagination: (totalItems: number, page: number, setPage: React.Dispatch<React.SetStateAction<number>>) => React.ReactNode;
};

export function ScheduledBookingsTab(props: ScheduledBookingsTabProps) {
  const {
    bookingSearchTerm,
    upcomingBookingsFiltered,
    upcomingBookings,
    upcomingBookingsPage,
    setUpcomingBookingsPage,
    itemsPerPage,
    getUserEmail,
    getUserRole,
    getFacilityName,
    formatDateTime,
    formatTime,
    formatDate,
    renderPurposeButton,
    renderEquipmentLine,
    renderNeedsBadge,
    isAdmin,
    forceActiveBookingMutation,
    adminBookingActionMutation,
    equipmentRequestDecisionMutation,
    renderPagination,
  } = props;

  const [selectedBooking, setSelectedBooking] = useState<FacilityBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [bookingDateInput, setBookingDateInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [purposeInput, setPurposeInput] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [programInput, setProgramInput] = useState("");
  const [actionError, setActionError] = useState("");
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [forceStartBooking, setForceStartBooking] = useState<FacilityBooking | null>(null);
  const [forceStartReason, setForceStartReason] = useState("");
  const [forceStartError, setForceStartError] = useState("");
  const lastUpcomingPage = Math.max(0, Math.ceil(upcomingBookingsFiltered.length / itemsPerPage) - 1);
  const visibleUpcomingPage = Math.min(upcomingBookingsPage, lastUpcomingPage);

  const handleBookingClick = (booking: FacilityBooking) => {
    const startFields = getManilaDateTimeInputs(booking.startTime);
    const endFields = getManilaDateTimeInputs(booking.endTime);
    setSelectedBooking(booking);
    setReason("");
    setActionError("");
    setBookingDateInput(startFields.date);
    setStartTimeInput(startFields.time);
    setEndTimeInput(endFields.time);
    setPurposeInput(booking.purpose);
    setParticipantsInput(String(booking.participants));
    setNameInput(booking.name ?? "");
    setProgramInput(booking.program ?? "");
    setIsEditDetailsOpen(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBooking(null);
    setActionError("");
  };

  const runBookingAction = async (action: string) => {
    if (!selectedBooking) return;
    if (action !== "approve" && reason.trim().length < 5) {
      setActionError("Please enter a reason of at least 5 characters.");
      return;
    }
    const modifiesDetails = action === "modify" || action === "reschedule";
    const startTime = modifiesDetails
      ? manilaDateTimeToIso(bookingDateInput, startTimeInput)
      : null;
    const endTime = modifiesDetails
      ? manilaDateTimeToIso(bookingDateInput, endTimeInput)
      : null;
    if (modifiesDetails && (!startTime || !endTime)) {
      setActionError("Enter a valid date, start time, and end time.");
      return;
    }
    setActionError("");
    try {
      await adminBookingActionMutation.mutateAsync({
        bookingId: selectedBooking.id,
        action,
        reason: reason.trim(),
        ...(startTime && endTime ? {
          startTime,
          endTime,
          purpose: purposeInput,
          participants: Number(participantsInput),
          name: nameInput,
          program: programInput,
        } : {}),
      });
      closeModal();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be completed.");
    }
  };

  const approveBooking = async (booking: FacilityBooking) => {
    try {
      await adminBookingActionMutation.mutateAsync({
        bookingId: booking.id,
        action: "approve",
      });
    } catch (error) {
      handleBookingClick(booking);
      setActionError(error instanceof Error ? error.message : "The booking could not be approved.");
    }
  };

  const renderAdminRowActions = (booking: FacilityBooking) => {
    if (!isAdmin) return null;

    const canReviewBooking = booking.status === "pending";
    const canModifyBooking = booking.status === "pending"
      || (booking.status === "approved" && new Date(booking.startTime) > new Date());
    const hasPendingEquipment = Boolean(booking.equipment)
      && booking.equipmentRequestStatus === "pending";
    const canForceStart = ["pending", "approved"].includes(booking.status)
      && new Date(booking.startTime) > new Date();

    if (!canReviewBooking && !canModifyBooking && !hasPendingEquipment && !canForceStart) return null;

    return (
      <div className="flex min-w-0 flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
        {canReviewBooking && (
          <>
            <Button
              type="button"
              size="sm"
              className="min-h-[40px]"
              disabled={adminBookingActionMutation.isPending}
              onClick={() => void approveBooking(booking)}
            >
              Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" className="min-h-[40px]" onClick={() => handleBookingClick(booking)}>
              Decline
            </Button>
          </>
        )}
        {canModifyBooking && (
          <Button type="button" size="sm" variant="outline" className="min-h-[40px]" onClick={() => handleBookingClick(booking)}>
            Modify / Reschedule
          </Button>
        )}
        {hasPendingEquipment && (
          <Button type="button" size="sm" variant="outline" className="min-h-[40px]" onClick={() => handleBookingClick(booking)}>
            Review equipment
          </Button>
        )}
        {canForceStart && (
          <Button
            type="button"
            size="sm"
            className="min-h-[40px] bg-amber-500 text-amber-950 hover:bg-amber-600"
            disabled={forceActiveBookingMutation.isPending}
            onClick={() => {
              setForceStartBooking(booking);
              setForceStartReason("");
              setForceStartError("");
            }}
          >
            <Zap className="mr-1.5 h-4 w-4" />
            Force Active
          </Button>
        )}
      </div>
    );
  };

  const confirmForceStart = async () => {
    if (!forceStartBooking) return;
    const reasonText = forceStartReason.trim();
    if (reasonText.length < 5) {
      setForceStartError("Enter a reason of at least 5 characters.");
      return;
    }

    setForceStartError("");
    try {
      await forceActiveBookingMutation.mutateAsync({ booking: forceStartBooking, reason: reasonText });
      setForceStartBooking(null);
      setForceStartReason("");
    } catch (error) {
      setForceStartError(error instanceof Error ? error.message : "The booking could not be force-started.");
    }
  };

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden rounded-lg bg-gray-50 p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Scheduled Facility Bookings</h3>
        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
          {bookingSearchTerm
            ? `${upcomingBookingsFiltered.length || 0}/${upcomingBookings.length || 0}`
            : `${upcomingBookingsFiltered.length || 0}`} bookings
        </span>
      </div>
      {upcomingBookings.length > 0 ? (
        <div className="min-w-0 space-y-3">
          {upcomingBookingsFiltered
            .slice(visibleUpcomingPage * itemsPerPage, (visibleUpcomingPage + 1) * itemsPerPage)
            .map((booking) => (
              <div key={booking.id} onClick={() => handleBookingClick(booking)} className="min-w-0 max-w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:border-pink-200 hover:shadow-sm sm:p-4">
                {/* Mobile layout */}
                <div className="flex min-w-0 flex-col gap-3 lg:hidden">
                  <div className="cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="bg-pink-100 p-2 rounded-lg flex-shrink-0">
                        <Clock className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm break-words">{getUserEmail(booking.userId)}</h4>
                        <p className="text-xs text-gray-600 mt-0.5 break-words">{getFacilityName(booking.facilityId)}</p>
                        <p className="text-xs text-gray-600 mt-0.5 break-words">Role: {getUserRole(booking.userId)}</p>
                        <p className="text-xs text-gray-600 mt-0.5 break-words">Name: {booking.name || "Not recorded"} · Program: {booking.program || "Not recorded"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-11">
                      <span className="text-xs font-medium text-gray-500">Participants:</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {booking.participants || 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-11">
                    <div>
                      <p className="text-xs font-medium text-gray-900">Date</p>
                      <p className="text-xs text-gray-600 mt-0.5">{formatDate(booking.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">Time</p>
                      <p className="text-xs text-gray-600 mt-0.5">{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-11">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium ${booking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}`}>
                      {booking.status === "pending" ? "Pending Approval" : "Scheduled"}
                    </span>
                    {!!booking.equipment && booking.equipmentRequestStatus && (
                      <Badge className="max-w-full whitespace-normal text-left" variant={booking.equipmentRequestStatus === "approved" ? "default" : ["denied", "declined"].includes(booking.equipmentRequestStatus) ? "destructive" : "secondary"}>
                        Equipment {getEquipmentRequestStatusLabel(booking.equipmentRequestStatus)}
                      </Badge>
                    )}
                    {renderNeedsBadge(booking)}
                  </div>
                  {booking.purpose && <div className="pl-11">{renderPurposeButton(booking, 'scheduled-mobile')}</div>}
                  </div>
                </div>
                {/* Desktop layout */}
                <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  {/* Left section: User info */}
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="shrink-0 rounded-lg bg-pink-100 p-2.5">
                        <Clock className="h-5 w-5 text-pink-600" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="break-words font-semibold text-gray-900 text-base leading-tight">{getUserEmail(booking.userId)}</h4>
                        <p className="break-words text-sm text-gray-600 mt-0.5 leading-tight">{getFacilityName(booking.facilityId)}</p>
                        <p className="break-words text-xs text-gray-600 mt-0.5">Role: {getUserRole(booking.userId)}</p>
                        <p className="break-words text-xs text-gray-600 mt-0.5">Name: {booking.name || "Not recorded"} · Program: {booking.program || "Not recorded"}</p>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">Participants:</span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{booking.participants || 0}</span>
                          {booking.purpose && (
                            <>
                              <span className="text-gray-300">•</span>
                              {renderPurposeButton(booking, 'scheduled-desktop', 'inline-flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 transition-colors')}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Right section: time and grouped booking status */}
                  <div className="grid min-w-0 grid-cols-3 gap-3">
                      <div className="min-w-0 text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Date</p>
                        <p className="break-words text-sm font-semibold text-gray-900">{formatDate(booking.startTime)}</p>
                      </div>
                      <div className="min-w-0 text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Starts</p>
                        <p className="break-words text-base font-semibold text-gray-900">{formatTime(booking.startTime)}</p>
                      </div>
                      <div className="min-w-0 text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Ends</p>
                        <p className="break-words text-base font-semibold text-gray-900">{formatTime(booking.endTime)}</p>
                      </div>
                      <div className="col-span-3 flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-medium ${booking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}`}>
                          {booking.status === "pending" ? "Pending Approval" : "Scheduled"}
                        </span>
                        {!!booking.equipment && booking.equipmentRequestStatus && (
                          <Badge className="max-w-full whitespace-normal text-left" variant={booking.equipmentRequestStatus === "approved" ? "default" : ["denied", "declined"].includes(booking.equipmentRequestStatus) ? "destructive" : "secondary"}>
                            Equipment {getEquipmentRequestStatusLabel(booking.equipmentRequestStatus)}
                          </Badge>
                        )}
                        {renderNeedsBadge(booking)}
                      </div>
                  </div>
                </div>
                {!!booking.equipment && (
                  <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-md border border-gray-100 bg-gray-50 p-3">
                    <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-700">Booked Equipment</h5>
                    <div className="min-w-0">{renderEquipmentLine(booking)}</div>
                  </div>
                )}
                <div className="mt-3 border-t border-gray-100 pt-3">
                  {renderAdminRowActions(booking)}
                </div>
              </div>
            ))}
          {upcomingBookingsFiltered.length > itemsPerPage && renderPagination(upcomingBookingsFiltered.length, visibleUpcomingPage, setUpcomingBookingsPage)}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <Clock className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-600 text-sm">No upcoming facility bookings</p>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="mx-auto w-[calc(100%-1rem)] max-w-lg min-w-0 max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle>Scheduled Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="min-w-0 w-full space-y-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">User</h4>
                  <p className="break-all text-sm font-semibold text-gray-900">{getUserEmail(selectedBooking.userId)}</p>
                  <p className="text-xs text-gray-600 mt-1">Role: {getUserRole(selectedBooking.userId)}</p>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                  <Badge className={selectedBooking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}>
                    {selectedBooking.status === "pending" ? "Pending Approval" : "Scheduled"}
                  </Badge>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Facility</h4>
                <p className="break-words text-sm text-gray-900">{getFacilityName(selectedBooking.facilityId)}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Date</h4>
                  <p className="text-sm text-gray-900">{formatDate(selectedBooking.startTime)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Start Time</h4>
                  <p className="text-sm text-gray-900">{formatTime(selectedBooking.startTime)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">End Time</h4>
                  <p className="text-sm text-gray-900">{formatTime(selectedBooking.endTime)}</p>
                </div>
              </div>
              {(selectedBooking.declineReason || selectedBooking.cancellationReason || selectedBooking.rescheduleReason) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {selectedBooking.declineReason && <p><strong>Decline reason:</strong> {selectedBooking.declineReason}</p>}
                  {selectedBooking.cancellationReason && <p><strong>Cancellation reason:</strong> {selectedBooking.cancellationReason}</p>}
                  {selectedBooking.rescheduleReason && <p><strong>Last change reason:</strong> {selectedBooking.rescheduleReason}</p>}
                </div>
              )}
              {/* Booked Equipment */}
              {(() => {
                const eq: any = selectedBooking.equipment || {};
                const eqItems = Array.isArray(eq.items) ? eq.items : [];
                const hasOthers = eq.others && String(eq.others).trim().length > 0;
                if (eqItems.length > 0 || hasOthers) {
                  return (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-2">Booked Equipment</h3>
                        <div className="space-y-2">
                          {eqItems.map((item: string, idx: number) => (
                            <div key={`modal-eq-${idx}`} className="py-1 px-1">
                              <span className="text-sm text-gray-900 font-medium">{item}</span>
                            </div>
                          ))}
                          {hasOthers && (
                            <div className="mt-1 py-1 px-1">
                              <p className="text-xs font-semibold text-gray-600 mb-1">Additional Notes</p>
                              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                {String(eq.others).trim()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
              {isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900">Admin actions</h4>
                    {Boolean(selectedBooking.equipment) && (
                      <EquipmentApprovalPanel key={selectedBooking.id} booking={selectedBooking} mutation={equipmentRequestDecisionMutation} />
                    )}
                    {["pending", "approved"].includes(selectedBooking.status) && (
                      <>
                        <Collapsible
                          open={isEditDetailsOpen}
                          onOpenChange={setIsEditDetailsOpen}
                          className="min-w-0 rounded-lg border border-gray-200"
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 text-left text-sm font-semibold text-gray-800"
                            >
                              Edit Booking Details
                              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isEditDetailsOpen ? "rotate-180" : ""}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-3 border-t border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Date and times use Asia/Manila (UTC+8).</p>
                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                              <label className="min-w-0 text-xs font-medium text-gray-700 sm:col-span-2">
                                Date
                                <Input
                                  type="date"
                                  className="mt-1 h-11 w-full min-w-0 px-3 pr-3"
                                  value={bookingDateInput}
                                  onChange={(event) => setBookingDateInput(event.target.value)}
                                />
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700">
                                Start Time
                                <Input
                                  type="time"
                                  className="mt-1 h-11 w-full min-w-0 px-3 pr-3"
                                  value={startTimeInput}
                                  onChange={(event) => setStartTimeInput(event.target.value)}
                                />
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700">
                                End Time
                                <Input
                                  type="time"
                                  className="mt-1 h-11 w-full min-w-0 px-3 pr-3"
                                  value={endTimeInput}
                                  onChange={(event) => setEndTimeInput(event.target.value)}
                                />
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700">
                                Booker name
                                <Input className="mt-1 min-h-[44px] min-w-0" value={nameInput} maxLength={200} onChange={(event) => setNameInput(event.target.value)} />
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700">
                                Academic program
                                <select
                                  value={programInput}
                                  onChange={(event) => setProgramInput(event.target.value)}
                                  className="mt-1 flex min-h-[44px] w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="">Not recorded (keep unchanged)</option>
                                  {ACADEMIC_PROGRAM_OPTIONS.map((program) => <option key={program} value={program}>{program}</option>)}
                                </select>
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700">
                                Participants
                                <Input type="number" min={1} className="mt-1 min-h-[44px] min-w-0" value={participantsInput} onChange={(event) => setParticipantsInput(event.target.value)} />
                              </label>
                              <label className="min-w-0 text-xs font-medium text-gray-700 sm:col-span-2">
                                Purpose
                                <Textarea className="mt-1 min-h-[72px]" value={purposeInput} maxLength={200} onChange={(event) => setPurposeInput(event.target.value)} />
                              </label>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
                        <label className="block text-xs font-medium text-gray-700">
                          Required reason for decline or changes
                          <Textarea className="mt-1 min-h-[72px]" value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this action is needed" />
                        </label>
                        <div className="flex flex-row gap-2">
                          {selectedBooking.status === "pending" && (
                            <>
                              <Button
                                type="button"
                                className="min-h-[40px] min-w-0 flex-1 px-2 text-xs sm:text-sm"
                                disabled={adminBookingActionMutation.isPending}
                                onClick={() => void runBookingAction("approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                className="min-h-[40px] min-w-0 flex-1 px-2 text-xs sm:text-sm"
                                disabled={adminBookingActionMutation.isPending}
                                onClick={() => void runBookingAction("decline")}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-[40px] min-w-0 flex-1 px-2 text-xs sm:text-sm"
                            disabled={adminBookingActionMutation.isPending}
                            onClick={() => {
                              const startTime = manilaDateTimeToIso(bookingDateInput, startTimeInput);
                              const endTime = manilaDateTimeToIso(bookingDateInput, endTimeInput);
                              const changed = !startTime
                                || !endTime
                                || Date.parse(startTime) !== new Date(selectedBooking.startTime).getTime()
                                || Date.parse(endTime) !== new Date(selectedBooking.endTime).getTime();
                              void runBookingAction(changed ? "reschedule" : "modify");
                            }}
                          >
                            <span className="sm:hidden">Save / Reschedule</span>
                            <span className="hidden sm:inline">Save changes / Reschedule</span>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(forceStartBooking)}
        onOpenChange={(open) => {
          if (!open && !forceActiveBookingMutation.isPending) {
            setForceStartBooking(null);
            setForceStartError("");
          }
        }}
      >
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl mx-2">
          <DialogHeader>
            <DialogTitle>Reason for force-starting this booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              required
              autoFocus
              minLength={5}
              maxLength={1000}
              className="min-h-[100px]"
              value={forceStartReason}
              onChange={(event) => setForceStartReason(event.target.value)}
              placeholder="For example: Student arrived early or Manual room key release by admin."
              aria-label="Reason for force-starting this booking"
            />
            {forceStartError && <p role="alert" className="text-sm text-red-600">{forceStartError}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={forceActiveBookingMutation.isPending}
                onClick={() => setForceStartBooking(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-[44px] bg-amber-500 text-amber-950 hover:bg-amber-600"
                disabled={forceActiveBookingMutation.isPending || forceStartReason.trim().length < 5}
                onClick={() => void confirmForceStart()}
              >
                Confirm Force Start
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
