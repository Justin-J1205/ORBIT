import React, { useState } from 'react';
import { FacilityBooking } from '@shared/schema';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

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
    mutateAsync: (input: { bookingId: string; status: "approved" | "denied"; reason?: string }) => Promise<unknown>;
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
  } = props;

  const [selectedBooking, setSelectedBooking] = useState<FacilityBooking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [equipmentDecisionReason, setEquipmentDecisionReason] = useState("");
  const [equipmentDecisionError, setEquipmentDecisionError] = useState("");

  const handleBookingClick = (booking: FacilityBooking) => {
    setSelectedBooking(booking);
    setEquipmentDecisionReason("");
    setEquipmentDecisionError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedBooking(null);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mt-4 md:mt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Currently Active Facility Bookings</h3>
        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
          {bookingSearchTerm
            ? `${activeBookingsFiltered.length || 0}/${activeBookings.length || 0}`
            : `${activeBookingsFiltered.length || 0}`} bookings
        </span>
      </div>
      {activeBookings.length > 0 ? (
        <div className="space-y-3">
          {activeBookingsFiltered
            .slice(activeBookingsPage * itemsPerPage, (activeBookingsPage + 1) * itemsPerPage)
            .map((booking) => (
              <div key={booking.id} onClick={() => handleBookingClick(booking)} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all duration-200 cursor-pointer">
                {/* Mobile layout */}
                <div className="flex flex-col gap-3 md:hidden">
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
                  <div className="flex flex-wrap gap-2 pl-11">
                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                  </div>
                  {booking.purpose && <div className="pl-11">{renderPurposeButton(booking, 'active-mobile')}</div>}
                  {!!booking.equipment && (
                    <div className="pl-11 mt-2">
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <h5 className="text-xs font-semibold text-gray-700 mb-3">Equipment or Needs</h5>
                        <div className="space-y-2">
                          {renderEquipmentLine(booking)}
                        </div>
                        <div className="flex flex-col gap-2 mt-3">
                          {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && (
                            <>
                              <div className="text-xs text-gray-500 text-center">Confirmation required in:</div>
                              <div className="flex justify-center">
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
                                className="w-full text-xs"
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
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {!booking.equipment && booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && (
                    <div className="pl-11 space-y-2">
                      <div className="text-xs text-gray-500 text-center">Confirmation required in:</div>
                      <div className="flex justify-center">
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
                        className="w-full text-xs"
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
                <div className="hidden md:flex items-center justify-between gap-6">
                  {/* Left section: User info */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2.5 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-base leading-tight">{getUserEmail(booking.userId)}</h4>
                        <p className="text-sm text-gray-600 mt-0.5 leading-tight">{getFacilityName(booking.facilityId)}</p>
                        <p className="text-xs text-gray-600 mt-0.5">Name: {booking.name || "Not recorded"} · Program: {booking.program || "Not recorded"}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-500">Participants:</span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{booking.participants || 0}</span>
                          {booking.purpose && (
                            <>
                              <span className="text-gray-300">•</span>
                              {renderPurposeButton(booking, 'active-desktop', 'inline-flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 transition-colors')}
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
                        <p className="text-xs font-medium text-gray-500 mb-1">Started</p>
                        <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatTime(booking.startTime)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(booking.startTime)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-gray-500 mb-1">Ends</p>
                        <p className="text-lg font-semibold text-gray-900 whitespace-nowrap">{formatTime(booking.endTime)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(booking.endTime)}</p>
                      </div>
                    </div>
                    {/* Status and Actions */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 whitespace-nowrap">Active</span>
                      </div>
                      {booking.arrivalConfirmationDeadline && !booking.arrivalConfirmed && (
                        <div className="flex flex-col gap-2 items-end">
                          <div className="text-xs text-gray-500">Confirmation required in:</div>
                          <CountdownComponent expiry={booking.arrivalConfirmationDeadline} onExpire={() => onArrivalExpire(booking)} />
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              console.log('Confirm Arrival clicked', booking);
                              confirmArrivalMutation.mutate({ bookingId: booking.id });
                            }}
                            disabled={confirmArrivalMutation.isPending}
                            className="text-xs font-medium h-7 px-3 pointer-events-auto"
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
                    {/* Equipment List */}
                    {!!booking.equipment && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-3.5 w-[250px] h-[145px] flex flex-col shadow-sm">
                        <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
                          <h5 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Equipment or Needs</h5>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                          <div className="space-y-0">
                            {renderEquipmentLine(booking)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Active Booking Details</DialogTitle>
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
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
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
                  <div className="space-y-2 rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">Equipment borrowing request</h3>
                      <Badge variant="outline">{selectedBooking.equipmentRequestStatus || "Pending review"}</Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      Requester: {selectedBooking.name || "Not recorded"} · {getUserRole(selectedBooking.userId)} · Program/department: {selectedBooking.program || "Not recorded"}
                    </p>
                    <p className="text-xs text-gray-600">
                      Requested for: {formatDate(selectedBooking.startTime)} · {formatTime(selectedBooking.startTime)}-{formatTime(selectedBooking.endTime)}
                    </p>
                    {selectedBooking.equipmentRequestStatus === "pending" && (
                      <>
                        <Textarea
                          value={equipmentDecisionReason}
                          maxLength={1000}
                          onChange={(event) => setEquipmentDecisionReason(event.target.value)}
                          placeholder="A reason is required to decline this equipment request."
                        />
                        {equipmentDecisionError && <p role="alert" className="text-sm text-red-600">{equipmentDecisionError}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={equipmentRequestDecisionMutation.isPending}
                            onClick={() => void equipmentRequestDecisionMutation.mutateAsync({
                              bookingId: selectedBooking.id,
                              status: "approved",
                            }).catch((error) => setEquipmentDecisionError(error instanceof Error ? error.message : "The decision failed."))}
                          >
                            Approve equipment
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={equipmentRequestDecisionMutation.isPending || equipmentDecisionReason.trim().length < 5}
                            onClick={() => void equipmentRequestDecisionMutation.mutateAsync({
                              bookingId: selectedBooking.id,
                              status: "denied",
                              reason: equipmentDecisionReason.trim(),
                            }).catch((error) => setEquipmentDecisionError(error instanceof Error ? error.message : "The decision failed."))}
                          >
                            Decline equipment
                          </Button>
                        </div>
                      </>
                    )}
                    {selectedBooking.equipmentDeclineReason && (
                      <p className="text-sm text-red-700"><strong>Decline reason:</strong> {selectedBooking.equipmentDeclineReason}</p>
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
