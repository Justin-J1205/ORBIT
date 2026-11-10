import React, { useState } from 'react';
import { FacilityBooking } from '@shared/schema';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ACADEMIC_PROGRAM_OPTIONS } from "@shared/bookingRules";

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
  forceActiveBookingMutation: { mutate: (booking: FacilityBooking) => void; isPending: boolean };
  adminBookingActionMutation: {
    mutateAsync: (input: { bookingId: string; action: string; reason?: string; startTime?: string; endTime?: string; facilityId?: number; participants?: number; purpose?: string; name?: string; program?: string }) => Promise<unknown>;
    isPending: boolean;
  };
  equipmentRequestDecisionMutation: {
    mutateAsync: (input: { bookingId: string; status: "approved" | "denied"; reason?: string }) => Promise<unknown>;
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
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [purposeInput, setPurposeInput] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [programInput, setProgramInput] = useState("");
  const [actionError, setActionError] = useState("");
  const lastUpcomingPage = Math.max(0, Math.ceil(upcomingBookingsFiltered.length / itemsPerPage) - 1);
  const visibleUpcomingPage = Math.min(upcomingBookingsPage, lastUpcomingPage);

  const handleBookingClick = (booking: FacilityBooking) => {
    setSelectedBooking(booking);
    setReason("");
    setActionError("");
    setStartTimeInput(toLocalDateTime(booking.startTime));
    setEndTimeInput(toLocalDateTime(booking.endTime));
    setPurposeInput(booking.purpose);
    setParticipantsInput(String(booking.participants));
    setNameInput(booking.name ?? "");
    setProgramInput(booking.program ?? "");
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
    if (modifiesDetails && (!Number.isFinite(Date.parse(startTimeInput)) || !Number.isFinite(Date.parse(endTimeInput)))) {
      setActionError("Enter valid start and end times.");
      return;
    }
    setActionError("");
    try {
      await adminBookingActionMutation.mutateAsync({
        bookingId: selectedBooking.id,
        action,
        reason: reason.trim(),
        ...(modifiesDetails ? {
          startTime: new Date(startTimeInput).toISOString(),
          endTime: new Date(endTimeInput).toISOString(),
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

    if (!canReviewBooking && !canModifyBooking && !hasPendingEquipment) return null;

    return (
      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
        {canReviewBooking && (
          <>
            <Button
              type="button"
              size="sm"
              disabled={adminBookingActionMutation.isPending}
              onClick={() => void approveBooking(booking)}
            >
              Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => handleBookingClick(booking)}>
              Decline
            </Button>
          </>
        )}
        {canModifyBooking && (
          <Button type="button" size="sm" variant="outline" onClick={() => handleBookingClick(booking)}>
            Modify / Reschedule
          </Button>
        )}
        {hasPendingEquipment && (
          <Button type="button" size="sm" variant="outline" onClick={() => handleBookingClick(booking)}>
            Review equipment
          </Button>
        )}
      </div>
    );
  };

  const runEquipmentDecision = async (status: "approved" | "denied") => {
    if (!selectedBooking) return;
    if (status === "denied" && reason.trim().length < 5) {
      setActionError("Please enter a reason of at least 5 characters.");
      return;
    }
    setActionError("");
    try {
      await equipmentRequestDecisionMutation.mutateAsync({
        bookingId: selectedBooking.id,
        status,
        reason: reason.trim(),
      });
      setSelectedBooking((booking) => booking
        ? { ...booking, equipmentRequestStatus: status }
        : booking);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The equipment decision could not be completed.");
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Scheduled Facility Bookings</h3>
        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
          {bookingSearchTerm
            ? `${upcomingBookingsFiltered.length || 0}/${upcomingBookings.length || 0}`
            : `${upcomingBookingsFiltered.length || 0}`} bookings
        </span>
      </div>
      {upcomingBookings.length > 0 ? (
        <div className="space-y-3">
          {upcomingBookingsFiltered
            .slice(visibleUpcomingPage * itemsPerPage, (visibleUpcomingPage + 1) * itemsPerPage)
            .map((booking) => (
              <div key={booking.id} onClick={() => handleBookingClick(booking)} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-pink-200 hover:shadow-sm transition-all duration-200 cursor-pointer">
                {/* Mobile layout */}
                <div className="flex flex-col gap-3 md:hidden">
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
                  <div className="flex flex-wrap gap-2 pl-11">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium ${booking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}`}>
                      {booking.status === "pending" ? "Pending Approval" : "Scheduled"}
                    </span>
                    {!!booking.equipment && booking.equipmentRequestStatus && (
                      <Badge variant={booking.equipmentRequestStatus === "approved" ? "default" : booking.equipmentRequestStatus === "denied" ? "destructive" : "secondary"}>
                        Equipment {booking.equipmentRequestStatus}
                      </Badge>
                    )}
                    {renderNeedsBadge(booking)}
                  </div>
                  {booking.purpose && <div className="pl-11">{renderPurposeButton(booking, 'scheduled-mobile')}</div>}
                  </div>
                  {!!booking.equipment && (
                    <div className="pl-11 mt-2">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 mb-2">Booked Equipment</h5>
                        <div className="space-y-1">
                          {renderEquipmentLine(booking)}
                        </div>
                      </div>
                    </div>
                  )}
                  {isAdmin && new Date(booking.startTime) > new Date() && (
                    <div className="pl-11 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => forceActiveBookingMutation.mutate(booking)}
                        disabled={forceActiveBookingMutation.isPending}
                        className="bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-medium w-full"
                        aria-label={`Force booking ${booking.id} to active`}
                      >
                        ⚡ Force Active
                      </Button>
                    </div>
                  )}
                  {renderAdminRowActions(booking)}
                </div>
                {/* Desktop layout */}
                <div className="hidden md:flex items-center justify-between gap-6">
                  {/* Left section: User info */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-pink-100 p-2.5 rounded-lg">
                        <Clock className="h-5 w-5 text-pink-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-base leading-tight">{getUserEmail(booking.userId)}</h4>
                        <p className="text-sm text-gray-600 mt-0.5 leading-tight">{getFacilityName(booking.facilityId)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">Role: {getUserRole(booking.userId)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">Name: {booking.name || "Not recorded"} · Program: {booking.program || "Not recorded"}</p>
                        <div className="flex items-center gap-2 mt-1.5">
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
                  {/* Right section: Time, Status, Equipment, and Actions */}
                  <div className="flex items-center gap-6">
                    {/* Time Info */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Date</p>
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatDate(booking.startTime)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Starts</p>
                        <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatTime(booking.startTime)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Ends</p>
                        <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatTime(booking.endTime)}</p>
                      </div>
                    </div>
                    {/* Status and Actions */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${booking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}`}>
                          {booking.status === "pending" ? "Pending Approval" : "Scheduled"}
                        </span>
                        {!!booking.equipment && booking.equipmentRequestStatus && (
                          <Badge variant={booking.equipmentRequestStatus === "approved" ? "default" : booking.equipmentRequestStatus === "denied" ? "destructive" : "secondary"}>
                            Equipment {booking.equipmentRequestStatus}
                          </Badge>
                        )}
                        {renderNeedsBadge(booking)}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            forceActiveBookingMutation.mutate(booking);
                          }}
                          disabled={forceActiveBookingMutation.isPending}
                          className="bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-medium h-7 px-3 pointer-events-auto"
                          aria-label={`Force booking ${booking.id} to active`}
                        >
                          ⚡ Force Active
                        </Button>
                      </div>
                    </div>
                    {/* Equipment List */}
                    {!!booking.equipment && (
                      <div className="w-[250px]">
                        <div className="mb-2">
                          <h5 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Booked Equipment</h5>
                        </div>
                        <div className="space-y-1">
                          {renderEquipmentLine(booking)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scheduled Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">User</h4>
                  <p className="text-sm font-semibold text-gray-900">{getUserEmail(selectedBooking.userId)}</p>
                  <p className="text-xs text-gray-600 mt-1">Role: {getUserRole(selectedBooking.userId)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                  <Badge className={selectedBooking.status === "pending" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"}>
                    {selectedBooking.status === "pending" ? "Pending Approval" : "Scheduled"}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Name</h4>
                  <p className="text-sm text-gray-900">{selectedBooking.name || "Not recorded"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Program</h4>
                  <p className="text-sm text-gray-900">{selectedBooking.program || "Not recorded"}</p>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Facility</h4>
                <p className="text-sm text-gray-900">{getFacilityName(selectedBooking.facilityId)}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
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
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Participants</h4>
                <p className="text-sm text-gray-900">{selectedBooking.participants || 0}</p>
              </div>
              {(selectedBooking.declineReason || selectedBooking.cancellationReason || selectedBooking.rescheduleReason) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {selectedBooking.declineReason && <p><strong>Decline reason:</strong> {selectedBooking.declineReason}</p>}
                  {selectedBooking.cancellationReason && <p><strong>Cancellation reason:</strong> {selectedBooking.cancellationReason}</p>}
                  {selectedBooking.rescheduleReason && <p><strong>Last change reason:</strong> {selectedBooking.rescheduleReason}</p>}
                </div>
              )}
              {selectedBooking.purpose && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Purpose</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedBooking.purpose}</p>
                  </div>
                </>
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
                    {selectedBooking.status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={adminBookingActionMutation.isPending}
                          onClick={() => void runBookingAction("approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={adminBookingActionMutation.isPending}
                          onClick={() => void runBookingAction("decline")}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {["pending", "approved"].includes(selectedBooking.status) && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="text-xs font-medium text-gray-700">
                            Start
                            <Input type="datetime-local" value={startTimeInput} onChange={(event) => setStartTimeInput(event.target.value)} />
                          </label>
                          <label className="text-xs font-medium text-gray-700">
                            End
                            <Input type="datetime-local" value={endTimeInput} onChange={(event) => setEndTimeInput(event.target.value)} />
                          </label>
                          <label className="text-xs font-medium text-gray-700">
                            Booker name
                            <Input value={nameInput} maxLength={200} onChange={(event) => setNameInput(event.target.value)} />
                          </label>
                          <label className="text-xs font-medium text-gray-700">
                            Academic program
                            <select
                              value={programInput}
                              onChange={(event) => setProgramInput(event.target.value)}
                              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Not recorded (keep unchanged)</option>
                              {ACADEMIC_PROGRAM_OPTIONS.map((program) => <option key={program} value={program}>{program}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-gray-700">
                            Participants
                            <Input type="number" min={1} value={participantsInput} onChange={(event) => setParticipantsInput(event.target.value)} />
                          </label>
                        </div>
                        <label className="block text-xs font-medium text-gray-700">
                          Purpose
                          <Textarea value={purposeInput} maxLength={200} onChange={(event) => setPurposeInput(event.target.value)} />
                        </label>
                        <label className="block text-xs font-medium text-gray-700">
                          Required reason for changes, decline, cancellation, or equipment decline
                          <Textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this action is needed" />
                        </label>
                        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={adminBookingActionMutation.isPending}
                            onClick={() => {
                              const changed = Date.parse(startTimeInput) !== new Date(selectedBooking.startTime).getTime()
                                || Date.parse(endTimeInput) !== new Date(selectedBooking.endTime).getTime();
                              void runBookingAction(changed ? "reschedule" : "modify");
                            }}
                          >
                            Save changes / Reschedule
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={adminBookingActionMutation.isPending}
                            onClick={() => void runBookingAction("cancel")}
                          >
                            Delete booking
                          </Button>
                        </div>
                      </>
                    )}
                    {Boolean(selectedBooking.equipment) && (
                      <div className="rounded-md border border-gray-200 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-sm font-medium text-gray-900">Equipment borrowing request</h5>
                          <Badge variant="outline">{selectedBooking.equipmentRequestStatus || "Pending review"}</Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          Requester: {selectedBooking.name || "Not recorded"} · {getUserRole(selectedBooking.userId)} · Program/department: {selectedBooking.program || "Not recorded"}
                        </p>
                        <p className="text-xs text-gray-600">
                          Requested for: {formatDate(selectedBooking.startTime)} · {formatTime(selectedBooking.startTime)}-{formatTime(selectedBooking.endTime)} ({formatDuration(selectedBooking.startTime, selectedBooking.endTime)})
                        </p>
                        <div className="text-sm">{renderEquipmentLine(selectedBooking)}</div>
                        {selectedBooking.equipmentRequestStatus === "pending" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={equipmentRequestDecisionMutation.isPending}
                              onClick={() => void runEquipmentDecision("approved")}
                            >
                              Approve equipment
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={equipmentRequestDecisionMutation.isPending}
                              onClick={() => void runEquipmentDecision("denied")}
                            >
                              Decline equipment
                            </Button>
                          </div>
                        )}
                        {selectedBooking.equipmentDeclineReason && (
                          <p className="text-sm text-red-700"><strong>Decline reason:</strong> {selectedBooking.equipmentDeclineReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toLocalDateTime(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDuration(startValue: Date | string, endValue: Date | string): string {
  const durationMinutes = Math.max(0, Math.round((new Date(endValue).getTime() - new Date(startValue).getTime()) / 60_000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
