/**
 * formStateUtils.ts
 * 
 * Utilities for managing form state, equipment state, and default values.
 */

import { getNextAvailableStart, clampStartToLibrary, clampEndToLibrary } from './dateTimeUtils';
import { ACADEMIC_PROGRAM_OPTIONS, BOOKING_MIN_DURATION_MS } from '@/shared/bookingRules';
import { createEmptyEquipmentState, type EquipmentStateValue } from '../schemas/bookingSchema';

// Re-export for convenience
export { createEmptyEquipmentState } from '../schemas/bookingSchema';

/**
 * Get equipment items that are marked as "prepared"
 */
export function getPreparedEquipmentItems(equipmentState: Record<string, EquipmentStateValue>): string[] {
  return Object.keys(equipmentState).filter(
    (key) => key !== 'others' && equipmentState[key] === 'prepared'
  );
}

/**
 * Build equipment payload for API submission
 */
export function buildEquipmentPayload(
  equipmentState: Record<string, EquipmentStateValue>,
  equipmentOtherText: string
): { items: string[]; others: string | null } {
  const preparedItems = getPreparedEquipmentItems(equipmentState);
  return {
    items: preparedItems,
    others: equipmentOtherText.trim() || null,
  };
}

/**
 * Get default start time for booking form
 */
export function getDefaultStartTime(initialStartTime?: Date | null): Date {
  if (initialStartTime) {
    return new Date(initialStartTime);
  }
  return clampStartToLibrary(getNextAvailableStart());
}

/**
 * Get default end time for booking form
 */
export function getDefaultEndTime(defaultStartTime: Date, initialEndTime?: Date | null): Date {
  const base = initialEndTime
    ? new Date(initialEndTime)
    : new Date(defaultStartTime.getTime() + BOOKING_MIN_DURATION_MS);
  return clampEndToLibrary(base, defaultStartTime);
}

/**
 * Get selected equipment labels for display
 */
export function getSelectedEquipmentLabels(
  equipmentState: Record<string, EquipmentStateValue>,
  equipmentOtherText: string
): string[] {
  return Object.keys(equipmentState)
    .filter((key) => equipmentState[key])
    .filter((key) => !(key === 'others' && equipmentOtherText));
}

/**
 * Derive initial booking state from existing booking data
 */
export function deriveInitialBookingState(booking: any) {
  if (!booking) {
    return {
      facilityId: '',
      startTime: undefined,
      endTime: undefined,
      purpose: '',
      participants: 1,
      name: '',
      program: '',
      equipmentState: createEmptyEquipmentState(),
      equipmentOtherText: '',
    };
  }
  
  const equipmentItems = booking?.equipment?.items || [];
  const equipmentOthers = booking?.equipment?.others || '';
  
  const equipmentState: Record<string, EquipmentStateValue> = createEmptyEquipmentState();
  equipmentItems.forEach((item: string) => {
    if (item in equipmentState) {
      equipmentState[item] = 'prepared';
    }
  });
  if (equipmentOthers) {
    equipmentState.others = 'prepared';
  }
  
  return {
    facilityId: String(booking.facilityId || ''),
    startTime: booking.startTime ? new Date(booking.startTime) : undefined,
    endTime: booking.endTime ? new Date(booking.endTime) : undefined,
    purpose: booking.purpose || '',
    participants: booking.participants || 1,
    name: booking.name || '',
    program: ACADEMIC_PROGRAM_OPTIONS.includes(booking.program) ? booking.program : '',
    equipmentState,
    equipmentOtherText: equipmentOthers,
  };
}
