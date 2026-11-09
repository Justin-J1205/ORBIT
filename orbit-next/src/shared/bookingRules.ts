export const BOOKING_MIN_DURATION_MINUTES = 30;
export const BOOKING_MAX_DURATION_MINUTES = 120;

export const BOOKING_MIN_DURATION_MS = BOOKING_MIN_DURATION_MINUTES * 60 * 1000;
export const BOOKING_MAX_DURATION_MS = BOOKING_MAX_DURATION_MINUTES * 60 * 1000;

export const ACADEMIC_PROGRAM_OPTIONS = [
  "Accountancy & Business Administration",
  "Education",
  "Computer Studies",
  "Pharmacy & Chemistry",
  "Music",
  "Medical Laboratory Science",
  "Engineering",
  "Nursing",
  "Liberal Arts",
  "Nutrition & Dietetics Hotel & Restaurant Mgt.",
  "Faculty",
] as const;
