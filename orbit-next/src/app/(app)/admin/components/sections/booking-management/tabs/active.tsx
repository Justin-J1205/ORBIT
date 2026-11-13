import React, { useState } from 'react';
import { FacilityBooking } from '@shared/schema';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { EquipmentApprovalPanel } from "../EquipmentApprovalPanel";
import { getEquipmentRequestStatusLabel } from "@admin/lib/equipment";

export const BOOKING_MANAGEMENT_TAB_ACTIVE = 'active' as const;

export type ActiveBookingsTabProps = {
  bookingSearchTerm: string;
  activeBookingsFiltered: FacilityBooking[];
  activeBookings: FacilityBooking[];
  activeBookingsPage: number;
  setActiveBookingsPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  getUserEmail: (id: FacilityBooking['userId']) => string;
  getUserRole: (id: FacilityBooking['userId']) => string;
  getFacilityName: (id: FacilityBooking['facilityId']) => string;
  formatTime: (value: FacilityBooking['startTime']) => string;
  formatDate: (value: FacilityBooking['startTime']) => string;
  renderPurposeButton: (booking: FacilityBooking, idPrefix: string, triggerClass?: string) => React.ReactNode;
  renderEquipmentLine: (booking: FacilityBooking) => React.ReactNode;
  isAdmin: boolean;
  openEquipmentModal: (booking: FacilityBooking) => void;
  getNeedsStatusForBooking: (booking: FacilityBooking) => 'prepared' | 'not_available' | undefined;
  hasEquipmentBeenChecked: (booking: FacilityBooking) => boolean;
  onArrivalExpire: (booking: FacilityBooking) => void;
  confirmArrivalMutation: { mutate: (arg: { bookingId: FacilityBooking['id'] }) => void; isPending: boolean };
  onBookingEndExpire: (booking: FacilityBooking) => void;
  CountdownComponent: React.ComponentType<{ expiry: string | Date | undefined; onExpire?: () => void }>;
  renderPagination: (totalItems: number, page: number, setPage: React.Dispatch<React.SetStateAction<number>>) => React.ReactNode;
  equipmentRequestDecisionMutation: {
    mutateAsync: (input: {
      bookingId: string;
      itemKey: string;
      status: "approved" | "declined";
      reason?: string;
    }) => Promise<{ success: boolean; itemStatus: "approved" | "declined"; equipmentRequestStatus: string }>;
    isPending: boolean;
  };
  adminBookingActionMutation: {
    mutateAsync: (input: { bookingId: string; action: string; reason?: string }) => Promise<unknown>;
    isPending: boolean;
  };
};

export function ActiveBookingsTab(props: ActiveBookingsTabProps) {
  const {
    bookingSearchTerm,
    activeBookingsFiltered,
    activeBookings,
    activeBookingsPage,
    setActiveBookingsPage,
    itemsPerPage,
    getUserEmail,
    getUserRole,
    getFacilityName,
    formatTime,
    formatDate,
    renderPurposeButton,
    renderEquipmentLine,
    isAdmin,
    openEquipmentModal,
    getNeedsStatusForBooking,
    hasEquipmentBeenChecked,
    onArrivalExpire,
    confirmArrivalMutation,
    onBookingEndExpire,
    CountdownComponent,
    renderPagination,
    equipmentRequestDecisionMutation,
    adminBookingActionMutation,
  } = props;

  const [selectedBooking, setSelectedBooking] = useState<FacilityBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adminActionReason, setAdminActionReason] = useState("");
  const [adminActionError, setAdminActionError] = useState("");

  const handleBookingClick = (booking: FacilityBooking) => {
    setSelectedBooking(booking);
    setAdminActionReason("");
    setAdminActionError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBooking(null);
  };

  const cancelActiveBooking = async () => {
    if (!selectedBooking) return;
    if (adminActionReason.trim().length < 5) {
      setAdminActionError("Enter a cancellation reason of at least 5 characters.");
      return;
    }
    setAdminActionError("");
    try {
      await adminBookingActionMutation.mutateAsync({
        bookingId: selectedBooking.id,
        action: "cancel",
        reason: adminActionReason.trim(),
      });
      closeModal();
    } catch (error) {
      setAdminActionError(error instanceof Error ? error.message : "The booking could not be cancelled.");
    }
  };

  const hasPendingEquipment = (booking: FacilityBooking) =>
    Boolean(booking.equipment) && booking.equipmentRequestStatus === "pending";

  return (
    <div className="mt-4 min-w-0 max-w-full overflow-x-hidden rounded-lg bg-gray-50 p-4 sm:p-6 md:mt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Currently Active Facility Bookings</h3>
        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
          {bookingSearchTerm
            ? `${activeBookingsFiltered.length || 0}/${activeBookings.length || 0}`
            : `${activeBookingsFiltered.length || 0}`} bookings
        </span>
      </div>
      {activeBookings.length > 0 ? (
        <div className="min-w-0 space-y-3">
          {activeBookingsFiltered
            .slice(activeBookingsPage * itemsPerPage, (activeBookingsPage + 1) * itemsPerPage)
            .map((booking) => (
              <div key={booking.id} onClick={() => handleBookingClick(booking)} className="min-w-0 max-w-full cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:border-green-300 hover:shadow-sm sm:p-4">
                {/* Mobile layout */}
                <div className="flex min-w-0 flex-col gap-3 lg:hidden">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 break-words">{getUserEmail(booking.userId)}</h4>
                      <p className="text-xs text-gray-600 mt-0.5 break-words">{getFacilityName(booking.facilityId)}</p>
                      <p className="text-xs text-gray-600 mt-0.5">Role: {getUserRole(booking.userId)}</p>
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
                      <p className="text-xs font-medium text-gray-900">Started</p>
                      <p className="text-xs text-gray-600 mt-0.5">{formatTime(booking.startTime)}</p>
                      <p className="text-xs text-gray-500">{formatDate(booking.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">Ends</p>
                      <p className="text-xs text-gray-600 mt-0.5">{formatTime(booking.endTime)}</p>
                      <p className="text-xs text-gray-500">{formatDate(booking.endTime)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-11">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                    {!!booking.equipment && booking.equipmentRequestStatus && (
                      <Badge className="max-w-full whitespace-normal text-left" variant={booking.equipmentRequestStatus === "approved" ? "default" : ["denied", "declined"].includes(booking.equipmentRequestStatus) ? "destructive" : "secondary"}>
                        Equipment {getEquipmentRequestStatusLabel(booking.equipmentRequestStatus)}
                      </Badge>
                    )}
                  </div>
                  {booking.purpose && <div className="pl-11">{renderPurposeButton(booking, 'active-mobile')}</div>}
                  {isAdmin && (
                    <div className="flex justify-end pl-11" onClick={(event) => event.stopPropagation()}>
                      <Button type="button" size="sm" variant="outline" className="min-h-[40px] max-w-full whitespace-normal" onClick={() => handleBookingClick(booking)}>
                        {hasPendingEquipment(booking) ? "Review equipment" : "Booking details & actions"}
                      </Button>
                    </div>
                  )}
                  {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && (
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pl-11">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500">Confirmation required in:</div>
                        <CountdownComponent expiry={booking.arrivalConfirmationDeadline} onExpire={() => onArrivalExpire(booking)} />
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          confirmArrivalMutation.mutate({ bookingId: booking.id });
                        }}
                        variant="outline"
                        size="sm"
                        disabled={confirmArrivalMutation.isPending}
                        aria-label={`Confirm arrival for booking ${booking.id}`}
                        className="min-h-[40px] shrink-0 text-xs"
                      >
                        {confirmArrivalMutation.isPending ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Confirming...
                          </span>
                        ) : (
                          'Confirm Arrival'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                {/* Desktop layout */}
                <div className="hidden min-w-0 gap-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-green-100 p-2.5">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="break-all text-base font-semibold leading-tight text-gray-900">{getUserEmail(booking.userId)}</h4>
                      <p className="mt-0.5 break-words text-sm leading-tight text-gray-600">{getFacilityName(booking.facilityId)}</p>
                      <p className="mt-0.5 break-words text-xs text-gray-600">Name: {booking.name || "Not recorded"} · Program: {booking.program || "Not recorded"}</p>
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">Participants:</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">{booking.participants || 0}</span>
                        {booking.purpose && (
                          <>
                            <span className="text-gray-300">•</span>
                            {renderPurposeButton(booking, 'active-desktop', 'inline-flex max-w-full items-center gap-1 break-words text-xs text-pink-600 transition-colors hover:text-pink-700')}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <div className="min-w-0 text-center">
                      <p className="mb-1 text-xs font-medium text-gray-500">Started</p>
                      <p className="break-words text-base font-semibold text-gray-900">{formatTime(booking.startTime)}</p>
                      <p className="mt-0.5 break-words text-xs text-gray-500">{formatDate(booking.startTime)}</p>
                    </div>
                    <div className="min-w-0 text-center">
                      <p className="mb-1 text-xs font-medium text-gray-500">Ends</p>
                      <p className="break-words text-base font-semibold text-gray-900">{formatTime(booking.endTime)}</p>
                      <p className="mt-0.5 break-words text-xs text-gray-500">{formatDate(booking.endTime)}</p>
                    </div>
                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="inline-flex max-w-full items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Active</span>
                      {!!booking.equipment && booking.equipmentRequestStatus && (
                        <Badge className="max-w-full whitespace-normal text-left" variant={booking.equipmentRequestStatus === "approved" ? "default" : ["denied", "declined"].includes(booking.equipmentRequestStatus) ? "destructive" : "secondary"}>
                          Equipment {getEquipmentRequestStatusLabel(booking.equipmentRequestStatus)}
                        </Badge>
                      )}
                      {isAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-auto min-h-[40px] max-w-full whitespace-normal"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleBookingClick(booking);
                          }}
                        >
                          {hasPendingEquipment(booking) ? "Review equipment" : "Booking actions"}
                        </Button>
                      )}
                    </div>
                    {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && (
                      <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Confirmation required in:</p>
                          <CountdownComponent expiry={booking.arrivalConfirmationDeadline} onExpire={() => onArrivalExpire(booking)} />
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmArrivalMutation.mutate({ bookingId: booking.id });
                          }}
                          disabled={confirmArrivalMutation.isPending}
                          className="min-h-[40px] shrink-0 text-xs"
                          aria-label={`Confirm arrival for booking ${booking.id}`}
                        >
                          {confirmArrivalMutation.isPending ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Confirming...
                            </span>
                          ) : (
                            'Confirm Arrival'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {!!booking.equipment && (
                  <div className="mt-3 min-w-0 max-w-full overflow-hidden rounded-md border border-gray-100 bg-gray-50 p-3">
                    <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-700">Booked Equipment</h5>
                    <div className="min-w-0">{renderEquipmentLine(booking)}</div>
                  </div>
                )}
              </div>
            ))}
          {activeBookingsFiltered.length > itemsPerPage && renderPagination(activeBookingsFiltered.length, activeBookingsPage, setActiveBookingsPage)}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-600 text-sm">No active facility bookings</p>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl mx-2">
          <DialogHeader>
            <DialogTitle>Active Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">User</h4>
                  <p className="break-words text-sm font-semibold text-gray-900">{getUserEmail(selectedBooking.userId)}</p>
                  <p className="text-xs text-gray-600 mt-1">Role: {getUserRole(selectedBooking.userId)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Name</h4>
                  <p className="break-words text-sm text-gray-900">{selectedBooking.name || "Not recorded"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Program</h4>
                  <p className="break-words text-sm text-gray-900">{selectedBooking.program || "Not recorded"}</p>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Facility</h4>
                <p className="text-sm text-gray-900">{getFacilityName(selectedBooking.facilityId)}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Start Time</h4>
                  <p className="text-sm text-gray-900">{formatTime(selectedBooking.startTime)}</p>
                  <p className="text-xs text-gray-500">{formatDate(selectedBooking.startTime)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">End Time</h4>
                  <p className="text-sm text-gray-900">{formatTime(selectedBooking.endTime)}</p>
                  <p className="text-xs text-gray-500">{formatDate(selectedBooking.endTime)}</p>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Participants</h4>
                <p className="text-sm text-gray-900">{selectedBooking.participants || 0}</p>
              </div>
              {selectedBooking.purpose && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Purpose</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedBooking.purpose}</p>
                  </div>
                </>
              )}
              {/* Equipment Status */}
              {(() => {
                const eq: any = selectedBooking.equipment || {};
                const eqItems = Array.isArray(eq.items) ? eq.items : [];
                if (eqItems.length > 0) {
                  return (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-2">Equipment Status</h3>
                        <div className="space-y-2">
                          {eqItems.map((item: string, idx: number) => {
                            let statusValue = 'pending';
                            try {
                              const resp = String(selectedBooking?.adminResponse || '');
                              const jsonMatch = resp.match(/\{"items":\{[^}]*\}\}/);
                              if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (parsed.items && typeof parsed.items === 'object') {
                                  const itemKey = String(item).toLowerCase().replace(/\s+/g, '_');
                                  for (const [key, value] of Object.entries(parsed.items)) {
                                    const normalizedKey = String(key).toLowerCase().replace(/\s+/g, '_');
                                    if (normalizedKey === itemKey || String(key).toLowerCase() === String(item).toLowerCase()) {
                                      statusValue = String(value);
                                      break;
                                    }
                                  }
                                }
                              }
                            } catch {}

                            return (
                              <div key={`modal-eq-${idx}`} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-900 font-medium">{item}</span>
                                <Badge variant={
                                  statusValue === 'prepared' ? 'default' :
                                  statusValue === 'not_available' || statusValue === 'not available' ? 'destructive' :
                                  'secondary'
                                }>
                                  {statusValue === 'not_available' ? 'not available' : statusValue}
                                </Badge>
                              </div>
                            );
                          })}
                          {eq.others && String(eq.others).trim().length > 0 && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs font-semibold text-blue-900 mb-1">Additional Notes:</p>
                              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap break-words">
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
              {Boolean(isAdmin && selectedBooking.equipment) && (
                <>
                  <Separator />
                  <EquipmentApprovalPanel key={selectedBooking.id} booking={selectedBooking} mutation={equipmentRequestDecisionMutation} />
                </>
              )}
              {Boolean(isAdmin && selectedBooking.status === "approved") && (
                <>
                  <Separator />
                  <div className="space-y-2 rounded-md border border-gray-200 p-3">
                    <h3 className="text-sm font-semibold text-gray-900">Cancel active booking</h3>
                    <Textarea
                      value={adminActionReason}
                      maxLength={1000}
                      className="min-h-[44px]"
                      onChange={(event) => setAdminActionReason(event.target.value)}
                      placeholder="A cancellation reason of at least 5 characters is required."
                    />
                    {adminActionError && <p role="alert" className="text-sm text-red-600">{adminActionError}</p>}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="min-h-[44px] w-full sm:w-auto"
                      disabled={adminBookingActionMutation.isPending || adminActionReason.trim().length < 5}
                      onClick={() => void cancelActiveBooking()}
                    >
                      Cancel booking
                    </Button>
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
