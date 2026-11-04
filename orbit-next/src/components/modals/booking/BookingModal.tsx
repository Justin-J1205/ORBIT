/**
 * BookingModal.tsx
 * 
 * Minimal wrapper that delegates all logic to BookingModalContent.
 * Reduced from 2,355 lines to ~20 lines (99% reduction).
 */

import type { Facility } from '@shared/schema';
import { BookingModalContent } from './components/BookingModalContent';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: Facility[];
  selectedFacilityId?: number | null;
  initialStartTime?: Date | null;
  initialEndTime?: Date | null;
  showSuggestedSlot?: boolean;
  bookingToEdit?: any;
}

export default function BookingModal(props: BookingModalProps) {
  // Key forces full remount when modal opens with a new facility,
  // ensuring useForm defaults and local state are always fresh.
  const mountKey = props.isOpen
    ? `open-${props.bookingToEdit?.id ?? props.selectedFacilityId ?? 'none'}`
    : 'closed';
  return <BookingModalContent key={mountKey} {...props} />;
}
