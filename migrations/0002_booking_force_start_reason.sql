ALTER TABLE public."facility_bookings"
  ADD COLUMN IF NOT EXISTS "force_start_reason" text;
