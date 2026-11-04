/**
 * BookingModalContent.tsx
 * 
 * Complete booking modal implementation using all shared utilities and hooks.
 * This component orchestrates the booking creation flow with minimal custom logic.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/ui';
import { useAuth } from '@/hooks/data';
import { apiRequest } from '@/lib/api';
import { createBookingSchema } from '../schemas/bookingSchema';
import {
  getDefaultStartTime,
  getDefaultEndTime,
  buildEquipmentPayload,
  createEmptyEquipmentState,
  deriveInitialBookingState,
  getPredefinedFacilities,
  filterFacilitiesByRole,
} from '../utils';
import { useFacilities, useSlotManagement, useFormValidation } from '../hooks';
import { BookingForm } from './BookingForm';
import { FORM_LIMITS } from '../schemas/bookingSchema';
import { useQuery } from '@tanstack/react-query';

interface BookingModalContentProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: any[];
  selectedFacilityId?: number | null;
  initialStartTime?: Date | null;
  initialEndTime?: Date | null;
  bookingToEdit?: any;
}

export function BookingModalContent({
  isOpen,
  onClose,
  facilities: providedFacilities,
  selectedFacilityId,
  initialStartTime = null,
  initialEndTime = null,
  bookingToEdit = null,
}: BookingModalContentProps) {
  // Fetch campus list for campus name lookup (must be inside component)
  const { data: campusList = [] } = useQuery({
    queryKey: ["/api/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campuses");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  // Get filtered facilities
  const facilities = useMemo(() => 
    providedFacilities.length > 0 
      ? filterFacilitiesByRole(providedFacilities, user?.role) 
      : filterFacilitiesByRole(getPredefinedFacilities(), user?.role),
    [providedFacilities, user?.role]
  );

  // Form setup
  const bookingSchema = createBookingSchema();
  type BookingFormData = z.infer<typeof bookingSchema>;

  const initialBookingState = useMemo(() => deriveInitialBookingState(bookingToEdit), [bookingToEdit]);
  const defaultStartTime = useMemo(
    () => initialBookingState.startTime ?? getDefaultStartTime(initialStartTime),
    [initialBookingState.startTime, initialStartTime]
  );
  const defaultEndTime = useMemo(
    () => initialBookingState.endTime ?? getDefaultEndTime(defaultStartTime, initialEndTime),
    [initialBookingState.endTime, defaultStartTime, initialEndTime]
  );

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    defaultValues: {
      facilityId: initialBookingState.facilityId || selectedFacilityId?.toString() || facilities[0]?.id.toString() || "",
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      purpose: initialBookingState.purpose,
      participants: initialBookingState.participants,
      reminderOptIn: true,
      reminderLeadMinutes: 60,
    },
  });

  // Equipment state
  const [equipmentState, setEquipmentState] = useState(() => initialBookingState.equipmentState || createEmptyEquipmentState());
  const [equipmentOtherText, setEquipmentOtherText] = useState(initialBookingState.equipmentOtherText || '');

  // Slot management
  const facilityIdValue = form.watch("facilityId");
  const startTimeValue = form.watch("startTime");
  const endTimeValue = form.watch("endTime");
  
  const selectedFacility = useMemo(() => 
    facilities.find(f => f.id === parseInt(facilityIdValue, 10)),
    [facilities, facilityIdValue]
  );

  const slotManagement = useSlotManagement(isOpen, selectedFacility?.name);

  // Clear availability cache on close to prevent stale 'Current reservations'
  const handleClose = () => {
    queryClient.removeQueries({ queryKey: ['/api/availability'] });
    onClose();
  };
  const { data: userBookingsData } = useQuery({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/bookings');
      return res.json();
    },
    enabled: isOpen,
  });

  const allBookings = userBookingsData || [];

  console.log('[BookingModal] User bookings loaded:', allBookings.length, 'bookings');
  console.log('[BookingModal] All bookings data:', allBookings);
  console.log('[BookingModal] Validation data:', {
    facilityId: facilityIdValue,
    startTime: startTimeValue,
    endTime: endTimeValue,
    allBookingsCount: allBookings.length,
  });

  // Form validation
  const { formValidationWarnings } = useFormValidation({
    facilityId: facilityIdValue,
    startTime: startTimeValue,
    endTime: endTimeValue,
    purpose: form.watch("purpose"),
    participants: form.watch("participants"),
    facilities,
    allBookings,
    userEmail: user?.email,
    existingBookingId: bookingToEdit?.id,
    isAdmin,
  });

  console.log('[BookingModal] Validation warnings:', formValidationWarnings);

  // Booking mutation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    facilityName: string;
    campusName?: string;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const bookingData = {
        ...data,
        facilityId: parseInt(data.facilityId),
        startTime: data.startTime.toISOString(),
        endTime: data.endTime.toISOString(),
        equipment: buildEquipmentPayload(equipmentState, equipmentOtherText),
        reminderOptIn: data.reminderOptIn,
        reminderLeadMinutes: data.reminderLeadMinutes,
      };
      
      const response = await apiRequest(
        bookingToEdit ? "PUT" : "POST",
        bookingToEdit ? `/api/bookings/${bookingToEdit.id}` : "/api/bookings",
        bookingData
      );
      return response.json();
    },
    onSuccess: async () => {
      const bookedFacilityName = selectedFacility?.name || 'Facility';
      const bookedStart = startTimeValue;
      const bookedEnd = endTimeValue;
      // Find campus name from selectedFacility using campusList
      let campusName = '';
      // Use type assertion to access campusId if present
      const facilityCampusId = (selectedFacility as any)?.campusId;
      if (facilityCampusId && campusList.length > 0) {
        const campus = campusList.find((c: any) => c.id === facilityCampusId);
        campusName = campus?.name || '';
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] }),
      ]);
      setIsSubmitting(false);
      setIsProcessing(false);
      setLastSubmissionTime(Date.now());
      form.reset();
      setSuccessInfo({
        facilityName: bookedFacilityName,
        campusName,
        startTime: bookedStart,
        endTime: bookedEnd,
      });
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      setIsProcessing(false);

      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      const parsedMessage = rawMessage.replace(/^\d{3}:\s*/, '').trim();
      const details = error?.payload || {};
      const conflictHint =
        details?.error === 'UserHasOverlappingBooking' || details?.error === 'UserHasActiveBooking'
          ? ' You still have an overlapping or active booking. Please adjust the time slot or cancel the existing booking first.'
          : '';
      const description =
        details?.message || parsedMessage || 'Failed to create booking. Please try again.';
      
      toast({
        title: "Booking Error",
        description: `${description}${conflictHint}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormData) => {
    const now = Date.now();
    if (isSubmitting || (now - lastSubmissionTime < 2000)) return;

    if (formValidationWarnings.length > 0) {
      toast({
        title: "Validation Error",
        description: formValidationWarnings[0].description,
        variant: "destructive",
      });
      return;
    }

    // Show loading overlay, but do NOT close modal yet
    setIsSubmitting(true);
    setIsProcessing(true);
    createBookingMutation.mutate(data);
  };

  return (
    <>

      {/* Booking Form Dialog (only show if not processing or success) */}
      {isOpen && !isProcessing && !successInfo && (
        <Dialog open={isOpen} onOpenChange={handleClose}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Create Booking</DialogTitle>
            <DialogDescription className="sr-only">Fill in the form to book a facility.</DialogDescription>
            <BookingForm
              form={form}
              facilities={facilities}
              equipmentState={equipmentState}
              setEquipmentState={setEquipmentState}
              equipmentOtherText={equipmentOtherText}
              setEquipmentOtherText={setEquipmentOtherText}
              onSubmit={onSubmit}
              onClose={onClose}
              isSubmitting={isSubmitting}
              validationWarnings={formValidationWarnings}
              slotManagement={slotManagement}
              selectedFacility={selectedFacility}
              isAdmin={isAdmin}
              isEditing={!!bookingToEdit}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Processing / Loading Dialog */}
      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-xs text-center px-8 py-10 [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Processing Booking</DialogTitle>
          <DialogDescription className="sr-only">Please wait while your booking is being submitted.</DialogDescription>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800">Processing your booking...</p>
              <p className="text-xs text-gray-400 mt-1">Please wait a moment.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={!!successInfo} onOpenChange={(open) => { if (!open) { setSuccessInfo(null); handleClose(); } }}>
        <DialogContent className="max-w-sm text-center px-8 py-10">
          <DialogTitle className="sr-only">Booking Confirmed</DialogTitle>
          <DialogDescription className="sr-only">Your booking has been scheduled.</DialogDescription>
          {/* Animated checkmark */}
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <svg
                className="w-10 h-10 text-emerald-600"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">{bookingToEdit ? 'Booking Updated!' : 'Booking Scheduled!'}</h2>
          {successInfo && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 mb-6 text-left space-y-3">

                            {successInfo.campusName && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-black-400">Campus</span>
                  <span className="ml-auto text-sm font-semibold text-pink-700">{successInfo.campusName}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black-400">Facility</span>
                <span className="ml-auto text-sm font-semibold text-pink-700">{successInfo.facilityName}</span>
              </div>

              <div className="h-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black-400">Date</span>
                <span className="ml-auto text-sm font-semibold text-pink-700">
                  {successInfo.startTime ? format(successInfo.startTime, 'MMMM d, yyyy') : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black-400">Time</span>
                <span className="ml-auto text-sm font-semibold text-pink-700">
                  {successInfo.startTime && successInfo.endTime
                    ? `${format(successInfo.startTime, 'h:mm a')} – ${format(successInfo.endTime, 'h:mm a')}`
                    : '—'}
                </span>
              </div>
            </div>
          )}


          <Button className="w-full" onClick={() => { setSuccessInfo(null); handleClose(); }}>Done</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
