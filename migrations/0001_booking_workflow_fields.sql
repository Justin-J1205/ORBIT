ALTER TABLE public."facility_bookings"
  ADD COLUMN IF NOT EXISTS "name" character varying(200),
  ADD COLUMN IF NOT EXISTS "program" character varying(100),
  ADD COLUMN IF NOT EXISTS "client_request_id" uuid,
  ADD COLUMN IF NOT EXISTS "decline_reason" text,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text,
  ADD COLUMN IF NOT EXISTS "reschedule_reason" text,
  ADD COLUMN IF NOT EXISTS "equipment_request_status" character varying,
  ADD COLUMN IF NOT EXISTS "equipment_decline_reason" text;

CREATE UNIQUE INDEX IF NOT EXISTS "facility_bookings_client_request_id_unique"
  ON public."facility_bookings" ("client_request_id");

UPDATE public."facility_bookings"
SET "equipment_request_status" = 'pending'
WHERE "equipment" IS NOT NULL
  AND "equipment_request_status" IS NULL;
