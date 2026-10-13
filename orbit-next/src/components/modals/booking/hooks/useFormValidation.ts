/**
 * useFormValidation.ts
 * 
 * Custom hook for real-time form validation with booking-specific rules.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { validateBookingForm, type ValidationError } from '../utils/validationUtils';
import type { Facility } from '../utils/roleFilterUtils';

export interface FormValidationParams {
  facilityId?: string;
  startTime?: Date;
  endTime?: Date;
  purpose?: string;
  participants?: number;
  facilities: Facility[];
  allBookings: any[];
  userEmail?: string;
  existingBookingId?: number | string;
  isAdmin?: boolean;
}

export function useFormValidation(params: FormValidationParams) {
  const [formValidationWarnings, setFormValidationWarnings] = useState<ValidationError[]>([]);
  const paramsRef = useRef(params);
  
  // Update ref on every render
  paramsRef.current = params;

  const validateForm = useCallback(() => {
    const {
      facilityId,
      startTime,
      endTime,
      purpose,
      participants,
      facilities,
      allBookings,
      userEmail,
      existingBookingId,
    } = paramsRef.current;

    if (!facilityId || !startTime || !endTime) {
      setFormValidationWarnings([]);
      return [];
    }

    const errors = validateBookingForm(
      {
        facilityId,
        startTime,
        endTime,
        purpose: purpose || '',
        participants: participants || 1,
        allBookings: allBookings || [],
        existingBookingId,
        isAdmin: paramsRef.current.isAdmin || false,
      },
      facilities,
      userEmail
    );

    setFormValidationWarnings(errors);
    return errors;
  }, []);

  const clearWarnings = useCallback(() => {
    setFormValidationWarnings([]);
  }, []);

  // Auto-validate when key dependencies change
  useEffect(() => {
    console.log('[useFormValidation] Running validation with:', {
      facilityId: params.facilityId,
      startTime: params.startTime,
      endTime: params.endTime,
      allBookingsCount: params.allBookings?.length || 0,
    });
    validateForm();
  }, [
    params.facilityId,
    params.startTime?.getTime(),
    params.endTime?.getTime(),
    params.purpose,
    params.participants,
    params.userEmail,
    params.existingBookingId,
    params.allBookings?.length,
    validateForm,
  ]);

  return {
    formValidationWarnings,
    validateForm,
    clearWarnings,
  };
}
