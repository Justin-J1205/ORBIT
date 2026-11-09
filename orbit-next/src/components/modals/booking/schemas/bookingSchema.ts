/**
 * Booking Form Schema and Types
 * 
 * Zod schema and TypeScript types for booking form validation
 */

import { z } from 'zod';
import {
  ACADEMIC_PROGRAM_OPTIONS,
  BOOKING_MAX_DURATION_MS,
  BOOKING_MIN_DURATION_MS,
  BOOKING_MAX_DURATION_MINUTES,
  BOOKING_MIN_DURATION_MINUTES,
} from '@shared/bookingRules';

/**
 * Equipment options available for booking
 */
export const EQUIPMENT_OPTIONS = [
  { key: 'whiteboard', label: 'Whiteboard & Markers' },
  { key: 'projector', label: 'Projector' },
  { key: 'extension_cord', label: 'Extension Cord' },
  { key: 'hdmi', label: 'HDMI Cable' },
  { key: 'extra_chairs', label: 'Extra Chairs' },
];

/**
 * Equipment state value type
 */
export type EquipmentStateValue = 'prepared' | 'not_available' | false;

/**
 * Create empty equipment state object with all options set to false
 */
export function createEmptyEquipmentState(): Record<string, EquipmentStateValue> {
  const init: Record<string, EquipmentStateValue> = {};
  EQUIPMENT_OPTIONS.forEach(o => init[o.key] = false);
  return init;
}

/**
 * Character limits for form fields
 */
export const FORM_LIMITS = {
  PURPOSE_MAX: 200,
  OTHERS_MAX: 50,
  REMINDER_LEAD_MINUTES: 60,
} as const;

/**
 * Create booking form validation schema
 */
export function createBookingSchema() {
  return z
    .object({
      facilityId: z.string().min(1, "Please select a facility"),
      startTime: z.date({
        message: "A start date and time is required.",
      }),
      endTime: z.date({
        message: "An end date and time is required.",
      }),
      purpose: z.string().min(1, "Purpose is required"),
      participants: z.number().min(1, "Number of participants is required"),
      name: z.string().trim().min(1, "Name is required").max(200),
      program: z.enum(ACADEMIC_PROGRAM_OPTIONS, {
        errorMap: () => ({ message: "Please select a valid academic program" }),
      }),
      reminderOptIn: z.boolean().optional(),
      reminderLeadMinutes: z.number().optional(),
    })
    .superRefine((val, ctx) => {
      try {
        if (val.startTime && val.endTime) {
          const diff = val.endTime.getTime() - val.startTime.getTime();
          if (diff <= 0) {
            ctx.addIssue({ 
              code: z.ZodIssueCode.custom, 
              message: 'End time must be after start time', 
              path: ['endTime'] 
            });
          } else {
            if (diff < BOOKING_MIN_DURATION_MS) {
              ctx.addIssue({ 
                code: z.ZodIssueCode.custom, 
                message: `Bookings must be at least ${BOOKING_MIN_DURATION_MINUTES} minutes long`, 
                path: ['endTime'] 
              });
            }
            if (diff > BOOKING_MAX_DURATION_MS) {
              ctx.addIssue({ 
                code: z.ZodIssueCode.custom, 
                message: `Bookings cannot exceed ${BOOKING_MAX_DURATION_MINUTES} minutes`, 
                path: ['endTime'] 
              });
            }
          }
        }
      } catch (e) {
        // ignore
      }
    });
}

/**
 * Booking form data type
 */
export type BookingFormData = z.infer<ReturnType<typeof createBookingSchema>>;
