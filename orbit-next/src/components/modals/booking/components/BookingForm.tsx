/**
 * BookingForm.tsx
 * 
 * Complete booking form UI component with all form fields and submission logic.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/data';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormControl } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomTextarea } from '@/components/ui/custom-textarea';
import { NumberInputWithControls } from './NumberInputWithControls';
import { BookingSummary } from './BookingSummary';
import { EQUIPMENT_OPTIONS, FORM_LIMITS, type EquipmentStateValue } from '../schemas/bookingSchema';
import { getFacilityMaxCapacity } from '../utils';
import type { ValidationError } from '../utils/validationUtils';
import { apiRequest } from '@/lib/api';

const MAX_BOOKING_MS = 2 * 60 * 60 * 1000; // 2 hours max

type BookedBlock = { start: Date; end: Date; userId?: string; bookingId?: number; purpose?: string; bookedByAdmin?: boolean };

function mergeBookedSlots(slots: any[]): BookedBlock[] {
  const sorted = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const blocks: BookedBlock[] = [];
  let i = 0;
  while (i < sorted.length) {
    const s = sorted[i];
    if (s.status !== 'scheduled') { i++; continue; }
    const bid = s.bookings?.[0]?.id;
    const uid = s.bookings?.[0]?.userId;
    const purpose = s.bookings?.[0]?.purpose;
    let j = i + 1;
    while (j < sorted.length) {
      const n = sorted[j];
      const adj = new Date(n.start).getTime() === new Date(sorted[j - 1].end).getTime();
      if (n.status === 'scheduled' && n.bookings?.[0]?.id === bid && adj) j++;
      else break;
    }
    const fb = s.bookings?.[0];
    blocks.push({
      start: fb?.startTime ? new Date(fb.startTime) : new Date(s.start),
      end:   fb?.endTime   ? new Date(fb.endTime)   : new Date(sorted[j - 1].end),
      userId: uid, bookingId: bid, purpose,
      bookedByAdmin: s.bookings?.[0]?.bookedByAdmin ?? false,
    });
    i = j;
  }
  return blocks;
}

// 1. Define the helper function at the top level of your file (outside any component)
const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

// 2. Use it cleanly inside your component
function FacilityDayList({ facilityId, selectedDate }: { facilityId: number; selectedDate?: Date }) {
  const { user } = useAuth();
  const dateStr = isValidDate(selectedDate) ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(`${dateStr}T12:00:00`), 'EEEE, MMMM d, yyyy');

  const { data, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ['/api/availability', dateStr],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/availability?date=${dateStr}`);
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!facilityId,
  });

  const facilityData = useMemo(
    () => data?.data?.find((item: any) => item.facility?.id === facilityId),
    [data, facilityId]
  );
  const bookedBlocks = useMemo(() => mergeBookedSlots(facilityData?.slots ?? []), [facilityData]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading schedule…
      </div>
    );
  }

  const now = new Date();
  const visibleBlocks = bookedBlocks.filter(b => b.end > now);
  const morningBlocks = visibleBlocks.filter(b => b.start.getHours() < 12);
  const afternoonBlocks = visibleBlocks.filter(b => b.start.getHours() >= 12);

  const renderBlock = (block: BookedBlock, idx: number) => {
    const isOwn = user?.id === block.userId;
    const isAdminBlock = !!block.bookedByAdmin;
    const isActive = block.start <= now;

    const rowBg = isAdminBlock
      ? 'bg-red-50 border-red-200'
      : 'bg-pink-50 border-pink-200';
    const textColor = isAdminBlock ? 'text-red-700' : 'text-gray-700';

    return (
      <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${rowBg}`}>
        <span className={`text-xs flex-1 ${textColor}`}>
          {format(block.start, 'EEE MMM d, yyyy')} | {format(block.start, 'h:mm a')} – {format(block.end, 'h:mm a')}
        </span>
        {isAdminBlock && (
          <span className="text-[10px] font-medium text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">Admin</span>
        )}
        {isActive && !isAdminBlock && (
          <span className="text-[10px] font-medium text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">In Use</span>
        )}
        {isOwn && (
          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">You</span>
        )}
      </div>
    );
  };

  const emptyRow = (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-md">
      <span className="text-emerald-600 text-xs font-bold">&#x2713;</span>
      <span className="text-xs text-emerald-700">No reservations &mdash; fully available.</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Morning */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Morning Schedule</p>
        <div className="space-y-1">
          {morningBlocks.length > 0 ? morningBlocks.map(renderBlock) : emptyRow}
        </div>
      </div>
      {/* Afternoon */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Afternoon Schedule</p>
        <div className="space-y-1">
          {afternoonBlocks.length > 0 ? afternoonBlocks.map(renderBlock) : emptyRow}
        </div>
      </div>
    </div>
  );
}

interface BookingFormProps {
  form: any;
  facilities: any[];
  equipmentState: Record<string, EquipmentStateValue>;
  setEquipmentState: (state: Record<string, EquipmentStateValue>) => void;
  equipmentOtherText: string;
  setEquipmentOtherText: (text: string) => void;
  onSubmit: (data: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
  validationWarnings: ValidationError[];
  slotManagement: any;
  selectedFacility: any;
  isAdmin?: boolean;
  isEditing?: boolean;
}

export function BookingForm({
  form,
  facilities,
  equipmentState,
  setEquipmentState,
  equipmentOtherText,
  setEquipmentOtherText,
  onSubmit,
  onClose,
  isSubmitting,
  validationWarnings,
  selectedFacility,
  isAdmin = false,
  isEditing = false,
}: BookingFormProps) {
  // Detect daily booking limit warning in validationWarnings
  const hasDailyLimitError = validationWarnings.some(w => w.title === 'Daily Booking Limit Reached');
  const { PURPOSE_MAX, OTHERS_MAX } = FORM_LIMITS;
  const maxCapacity = selectedFacility ? getFacilityMaxCapacity(selectedFacility) : 8;

  // Initialize campus directly from the pre-selected facility prop
  const [selectedCampus, setSelectedCampus] = useState<string>(
    () => selectedFacility?.campusId ? String(selectedFacility.campusId) : ''
  );

  const { data: campusList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/campuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/campuses");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update campus when facility selection changes after mount
  useEffect(() => {
    if (selectedFacility?.campusId) {
      setSelectedCampus(String(selectedFacility.campusId));
    }
  }, [selectedFacility?.campusId]);

  const startTime: Date | undefined = form.watch('startTime');
  const endTime: Date | undefined = form.watch('endTime');
  const facilityIdWatched: string | undefined = form.watch('facilityId');

  // Filter facilities by selected campus
  const filteredFacilities = useMemo(() => {
    if (!selectedCampus) return [];
    const campusId = parseInt(selectedCampus, 10);
    return facilities.filter((f: any) => f.campusId === campusId);
  }, [facilities, selectedCampus]);

  // Reset facility selection when campus changes
  useEffect(() => {
    if (!selectedCampus) return;
    const campusId = parseInt(selectedCampus, 10);
    const currentFacility = facilities.find((f: any) => f.id.toString() === facilityIdWatched);
    if (currentFacility && currentFacility.campusId !== campusId) {
      const firstMatch = filteredFacilities[0];
      form.setValue('facilityId', firstMatch ? firstMatch.id.toString() : '');
    }
  }, [selectedCampus]);

// Helper to check if a date is valid
const isValidDate = (d: any): d is Date => d instanceof Date && !isNaN(d.getTime());

// Preserve the supplied end time on mount; adjust it only after a start edit.
const previousStartTime = useRef<number | null>(null);
useEffect(() => {
  if (!isValidDate(startTime)) return;
  const currentStart = startTime.getTime();
  if (previousStartTime.current === null) {
    previousStartTime.current = currentStart;
    return;
  }
  if (previousStartTime.current === currentStart) return;
  previousStartTime.current = currentStart;

  // Always reset to start + 2h, capped at 7:00 PM
  const defaultEnd = new Date(startTime.getTime() + MAX_BOOKING_MS);
  const opLimit = new Date(startTime); opLimit.setHours(19, 0, 0, 0);
  const newEnd = defaultEnd > opLimit ? opLimit : defaultEnd;
  form.setValue('endTime', newEnd);
}, [isValidDate(startTime) ? startTime.getTime() : null]);

// Preserve participant count on mount and reset it only after a facility change.
const previousFacilityId = useRef(facilityIdWatched);
useEffect(() => {
  if (previousFacilityId.current === facilityIdWatched) return;
  previousFacilityId.current = facilityIdWatched;
  form.setValue('participants', 1);
}, [facilityIdWatched]);

const { data: equipmentAvailability } = useQuery<Array<{ key: string; label: string; totalCount: number; bookedCount: number; available: number }>>({
  queryKey: [
    '/api/equipment/availability', 
    isValidDate(startTime) ? startTime.toISOString() : null, 
    isValidDate(endTime) ? endTime.toISOString() : null
  ],
  queryFn: async () => {
    const res = await apiRequest('GET', `/api/equipment/availability?startTime=${encodeURIComponent(startTime!.toISOString())}&endTime=${encodeURIComponent(endTime!.toISOString())}`);
    return res.json();
  },
  enabled: !!(selectedCampus && isValidDate(startTime) && isValidDate(endTime) && startTime < endTime),
  staleTime: 30_000,
});

  // Build a lookup: key -> available count
  const equipAvailMap = (equipmentAvailability ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = item.available;
    return acc;
  }, {});

  // Conflict detection: uses cached data from FacilityDayList (same queryKey)
  const conflictDateStr = isValidDate(startTime) ? format(startTime, 'yyyy-MM-dd') : null;
  const { data: conflictAvailData } = useQuery<{ data: any[] }>({
    queryKey: ['/api/availability', conflictDateStr ?? ''],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/availability?date=${conflictDateStr}`);
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!selectedCampus && !!facilityIdWatched && !!conflictDateStr,
  });
  const hasTimeConflict = useMemo(() => {
    if (!startTime || !endTime || !facilityIdWatched || !conflictAvailData) return false;
    const fd = (conflictAvailData as any).data?.find((item: any) => item.facility?.id === parseInt(facilityIdWatched));
    if (!fd) return false;
    return mergeBookedSlots(fd.slots ?? []).some(b => startTime < b.end && endTime > b.start);
  }, [conflictAvailData, startTime?.getTime(), endTime?.getTime(), facilityIdWatched]);


  // Admin and user validation
  const hasEndAfterHours = useMemo(() => {
    if (!endTime) return false;
    return endTime.getHours() > 19 || (endTime.getHours() === 19 && endTime.getMinutes() > 0);
  }, [endTime?.getTime()]);

  const hasEndExceedsMax = useMemo(() => {
    if (!startTime || !endTime) return false;
    return endTime.getTime() > startTime.getTime() + MAX_BOOKING_MS;
  }, [startTime?.getTime(), endTime?.getTime()]);

  const hasBookingTooShort = useMemo(() => {
    if (!startTime || !endTime) return false;
    const durationMs = endTime.getTime() - startTime.getTime();
    return durationMs > 0 && durationMs < 30 * 60 * 1000;
  }, [startTime?.getTime(), endTime?.getTime()]);

  const hasStartInPast = useMemo(() => {
    if (!startTime) return false;
    return startTime.getTime() < Date.now();
  }, [startTime?.getTime()]);

  const hasStartBeforeHours = useMemo(() => {
    if (!startTime) return false;
    return startTime.getHours() < 7 || (startTime.getHours() === 7 && startTime.getMinutes() < 30);
  }, [startTime?.getTime()]);

  const hasInvalidTimeOrder = useMemo(() => {
    if (!startTime || !endTime) return false;
    return endTime.getTime() <= startTime.getTime();
  }, [startTime?.getTime(), endTime?.getTime()]);

  // Granular red flags per input box
  const startDateHasError = !isAdmin && hasStartInPast;
  const startTimeHasError = !isAdmin && (hasStartInPast || hasStartBeforeHours || hasInvalidTimeOrder || hasTimeConflict);
  const endTimeHasError = !isAdmin && (hasEndAfterHours || hasEndExceedsMax || hasBookingTooShort || hasInvalidTimeOrder || hasTimeConflict);

  const hasAnyTimeError = !isAdmin && (hasTimeConflict || hasEndAfterHours || hasEndExceedsMax || hasBookingTooShort || hasStartInPast || hasStartBeforeHours || hasInvalidTimeOrder);

  // Admin warnings (do not block submit)
  const adminWarnings: string[] = [];
  if (isAdmin) {
    if (hasStartInPast) adminWarnings.push('Start time is in the past.');
    if (hasInvalidTimeOrder) adminWarnings.push('Start time must be earlier than the end time.');
    if (hasTimeConflict) adminWarnings.push('Overlaps with an existing booking. You must cancel the other booking if you want to override.');
  }

  const purposeValue = form.watch('purpose');
  const isPurposeEmpty = !purposeValue || purposeValue.trim().length === 0;

  const today = new Date();
  const minDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-semibold">{isEditing ? 'Reschedule Booking' : 'Create Booking'}</DialogTitle>
          <DialogDescription>{isEditing ? 'Update the date, time, or details for this booking.' : 'Book a facility for your event or meeting.'}</DialogDescription>
        </DialogHeader>

        {/* Booking Policies */}
        {!isAdmin && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-2">Booking Policies</p>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>• School operating hours <strong>(7:30 AM - 7:00 PM)</strong>. Room access is only available during these hours.</li>
              <li>• Maximum booking duration: <strong>2 hours</strong></li>
              <li>• Maximum bookings per day: <strong>2</strong></li>
              <li>• Please provide a clear purpose for your booking</li>
              <li>• Check the schedule for existing reservations before booking</li>


            </ul>
          </div>
        )}

        {/* Admin banner */}
        {isAdmin && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-blue-500 text-sm flex-shrink-0 mt-0.5">Admin Mode</span>
            <div>
              <p className="font-semibold text-blue-800 text-sm">Admin Booking</p>
              <p className="text-xs text-blue-600 mt-0.5">Time limits and same-day restrictions are waived.</p>
            </div>
          </div>
        )}

        {/* Campus & Facility Selection */}
        <div className="grid md:grid-cols-3 gap-4">
          <FormItem>
            <Label>Campus <span className="text-red-500">*</span></Label>
            <Select onValueChange={(val) => setSelectedCampus(val)} value={selectedCampus || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Select Campus" />
              </SelectTrigger>
              <SelectContent>
                {campusList.map((campus) => (
                  <SelectItem key={campus.id} value={String(campus.id)}>{campus.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>

          <FormField
            control={form.control}
            name="facilityId"
            render={({ field }) => (
              <FormItem>
                <Label>Facility <span className="text-red-500">*</span></Label>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCampus}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedCampus ? "Select a facility" : "Select Campus First"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredFacilities.map((facility) => (
                      <SelectItem key={facility.id} value={facility.id.toString()}>
                        {facility.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="participants"
            render={({ field }) => (
              <FormItem>
                <Label>Number of Participants</Label>
                <NumberInputWithControls
                  value={field.value}
                  onChange={field.onChange}
                  min={1}
                  max={maxCapacity}
                  disabled={!selectedCampus}
                />
                {selectedCampus && selectedFacility && (
                  <p className="text-xs text-gray-500 mt-1">Max capacity: <strong>{maxCapacity}</strong> {maxCapacity === 1 ? 'person' : 'people'}</p>
                )}
              </FormItem>
            )}
          />
        </div>

        {/* Facility schedule */}
        {selectedCampus && facilityIdWatched ? (
          <div className="border rounded-lg p-4 bg-gray-50 min-h-[140px] transition-all duration-200">
            <p className="text-[11px] font-semibold text-gray-800 uppercase tracking-wide mb-3">
              Current reservations {isValidDate(startTime) ? `on ${format(startTime, 'MMM d, yyyy')}` : ''}
            </p>
            <FacilityDayList
              facilityId={parseInt(facilityIdWatched)}
              selectedDate={startTime}
            />
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/50 min-h-[80px] transition-all duration-200">
            <p className="text-xs text-gray-400 text-center">Select a campus, facility, and date to view current reservations.</p>
          </div>
        )}

        {/* Date and Time */}
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <Label>Start Date &amp; Time</Label>
                <div className="grid grid-cols-2 gap-3">
                  <FormControl>
                    <Input
                      type="date"
                      min={minDate}
                      className={startDateHasError ? 'border-red-500 focus-visible:ring-red-400' : ''}
                      value={isValidDate(field.value) ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        const newDate = isValidDate(field.value) ? new Date(field.value) : new Date();
                        newDate.setFullYear(year, month - 1, day);
                        field.onChange(newDate);
                      }}
                    />
                  </FormControl>
                  <FormControl>
                    <Input
                      type="time"
                      className={startTimeHasError ? 'border-red-500 focus-visible:ring-red-400' : ''}
                      value={isValidDate(field.value) ? format(field.value, 'HH:mm') : ''}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const currentDate = isValidDate(field.value) ? field.value : new Date();
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                        const newDate = new Date(currentDate);
                        newDate.setHours(hours, minutes, 0, 0);
                        field.onChange(newDate);
                      }}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => {
              const maxTimeStr = !isAdmin && startTime ? (() => {
                const cap2h = new Date(startTime.getTime() + MAX_BOOKING_MS);
                const cap7pm = new Date(startTime); cap7pm.setHours(19, 0, 0, 0);
                return format(cap2h < cap7pm ? cap2h : cap7pm, 'HH:mm');
              })() : undefined;
              return (
                <FormItem>
                  <Label>
                    End Time
                    {!isAdmin && <span className="text-xs text-gray-400 font-normal ml-1">(max 2h · before 7 PM)</span>}
                  </Label>
                  <FormControl>
                    <Input
                      type="time"
                      max={isAdmin ? undefined : maxTimeStr}
                      className={endTimeHasError ? 'border-red-500 focus-visible:ring-red-400' : ''}
                      value={isValidDate(field.value) ? format(field.value, 'HH:mm') : ''}
                      onChange={(e) => {
                        if (!e.target.value || !isValidDate(startTime)) return;
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                        const newEnd = new Date(startTime);
                        newEnd.setHours(hours, minutes, 0, 0);
                        field.onChange(newEnd);
                      }}
                    />
                  </FormControl>
                </FormItem>
              );
            }}
          />
        </div>

        {/* Inline time validation errors — bullet list */}
        {(hasAnyTimeError || hasDailyLimitError) && (
          <ul className="text-xs text-red-600 space-y-0.5 mt-1">
            {hasStartInPast && <li>• Start time cannot be in the past. Please select a future time.</li>}
            {hasInvalidTimeOrder && <li>• Start time must be earlier than the end time.</li>}
            {(hasEndAfterHours || hasStartBeforeHours) && <li>• School operating hours (7:30 AM - 7:00 PM). Room access is only available during these hours.</li>}
            {hasEndExceedsMax && <li>• Maximum booking duration is 2 hours.</li>}
            {hasBookingTooShort && <li>• Bookings must be at least 30 minutes long.</li>}
            {hasTimeConflict && <li>• Your selected time overlaps with an existing booking. Please choose a different time.</li>}
          </ul>
        )}

        {/* Admin warnings (non-blocking) */}
        {isAdmin && adminWarnings.length > 0 && (
          <ul className="text-xs text-amber-700 space-y-0.5 mt-1">
            {adminWarnings.map((msg, idx) => (
              <li key={idx}>• {msg}</li>
            ))}
          </ul>
        )}

        {/* Purpose */}
        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => {
            const purposeEmpty = !field.value || field.value.trim().length === 0;
            return (
              <FormItem>
                <Label>
                  Purpose <span className="text-red-500">*</span>
                </Label>
                <CustomTextarea
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Describe your purpose for booking this facility"
                  maxLength={PURPOSE_MAX}
                  isInvalid={purposeEmpty || field.value?.length >= PURPOSE_MAX}
                  required
                />
                {purposeEmpty && (
                  <p className="text-xs text-red-600 mt-1">Please provide a purpose for your booking.</p>
                )}
              </FormItem>
            );
          }}
        />

        {/* Equipment */}
        <div>
          <Label className="block mb-3">Additional Equipment</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {EQUIPMENT_OPTIONS.map((option) => {
              const availableCount = equipAvailMap[option.key];
              const isUnavailable = equipmentAvailability !== undefined && availableCount === 0;
              return (
                <div key={option.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!equipmentState[option.key]}
                    disabled={isUnavailable}
                    onChange={(e) => {
                      if (isUnavailable) return;
                      setEquipmentState({ ...equipmentState, [option.key]: e.target.checked ? 'prepared' : false });
                    }}
                    className="h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm ${isUnavailable ? 'text-gray-400' : ''}`}>{option.label}</span>
                  {isUnavailable && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      Not Available
                    </span>
                  )}
                </div>
              );
            })}
            <div>
              <Input
                value={equipmentOtherText}
                onChange={(e) => {
                  const value = e.target.value.slice(0, OTHERS_MAX);
                  setEquipmentOtherText(value);
                  setEquipmentState({ ...equipmentState, others: value.trim() ? 'prepared' : false });
                }}
                placeholder="Other equipment..."
                maxLength={OTHERS_MAX}
              />
            </div>
          </div>
        </div>

        {/* Booking Summary */}
        <BookingSummary
          facility={selectedCampus && selectedFacility ? selectedFacility : undefined}
          startTime={form.watch("startTime")}
          endTime={form.watch("endTime")}
          participants={selectedCampus && selectedFacility ? form.watch("participants") : undefined}
          purpose={form.watch("purpose")}
          equipment={equipmentState}
          equipmentOtherText={equipmentOtherText}
        />



        {(hasAnyTimeError || hasDailyLimitError) && (
          <ul className="text-xs text-red-600 space-y-0.5 mt-1">
            {hasDailyLimitError && <li>• You have reached the maximum of 2 bookings per day. Please cancel an existing booking first or choose a different day.</li>}
          </ul>
        )}

        {/* Footer Buttons */}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isPurposeEmpty || hasDailyLimitError || !selectedCampus}
            className={hasDailyLimitError ? 'opacity-60 cursor-not-allowed' : ''}
          >
            {isSubmitting
              ? 'Creating...'
              : hasDailyLimitError
              ? 'Daily Limit Reached'
              : hasAnyTimeError && !isAdmin
              ? 'Fix Time Errors'
              : isEditing ? 'Save Changes' : 'Create Booking'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}