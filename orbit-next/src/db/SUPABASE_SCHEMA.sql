

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    create type "public"."user_role" as enum ('student', 'faculty', 'admin', 'authorize_selga', 'authorize_bonifacio');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_status'
  ) then
    create type "public"."user_status" as enum ('active', 'banned', 'suspended');
  end if;
end $$;

create table if not exists public."activity_logs" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" character varying,
  "action" character varying not null,
  "details" text,
  "ip_address" character varying,
  "user_agent" text,
  "created_at" timestamp without time zone default now() not null
);

create table if not exists public."booking_reminders" (
  "id" uuid default gen_random_uuid() not null,
  "booking_id" uuid not null,
  "reminder_time" timestamp without time zone not null,
  "status" character varying default 'pending'::character varying not null,
  "attempts" integer default 0 not null,
  "last_attempt_at" timestamp without time zone,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create sequence if not exists public."campuses_id_seq";

create table if not exists public."campuses" (
  "id" integer default nextval('campuses_id_seq'::regclass) not null,
  "name" character varying not null,
  "is_active" boolean default true not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp without time zone default now() not null
);

create sequence if not exists public."computer_stations_id_seq";

create table if not exists public."computer_stations" (
  "id" integer default nextval('computer_stations_id_seq'::regclass) not null,
  "name" character varying not null,
  "location" character varying not null,
  "is_active" boolean default true not null,
  "created_at" timestamp without time zone default now() not null
);

create sequence if not exists public."equipment_inventory_id_seq";

create table if not exists public."equipment_inventory" (
  "id" integer default nextval('equipment_inventory_id_seq'::regclass) not null,
  "key" character varying not null,
  "label" character varying not null,
  "total_count" integer default 1 not null,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create sequence if not exists public."facilities_id_seq";

create table if not exists public."facilities" (
  "id" integer default nextval('facilities_id_seq'::regclass) not null,
  "name" character varying not null,
  "description" text,
  "capacity" integer not null,
  "image" character varying(255),
  "is_active" boolean default true not null,
  "unavailable_reason" text,
  "unavailable_dates" jsonb,
  "created_at" timestamp without time zone default now() not null,
  "campus_id" integer,
  "allowed_roles" character varying[] default '{student,faculty}'::character varying[] not null,
  "requires_arrival_confirmation" boolean default false not null
);

create table if not exists public."facility_bookings" (
  "id" uuid default gen_random_uuid() not null,
  "facility_id" integer not null,
  "user_id" character varying not null,
  "start_time" timestamp without time zone not null,
  "end_time" timestamp without time zone not null,
  "purpose" text not null,
  "participants" integer not null,
  "equipment" jsonb,
  "arrival_confirmation_deadline" timestamp without time zone,
  "arrival_confirmed" boolean default false,
  "status" character varying default 'pending'::character varying not null,
  "admin_id" character varying,
  "admin_response" text,
  "reminder_opt_in" boolean default true not null,
  "reminder_status" character varying default 'pending'::character varying not null,
  "reminder_scheduled_at" timestamp without time zone,
  "reminder_lead_minutes" integer default 60 not null,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create table if not exists public."faqs" (
  "id" uuid default gen_random_uuid() not null,
  "category" character varying not null,
  "question" text not null,
  "answer" text not null,
  "helpful_count" integer default 0 not null,
  "not_helpful_count" integer default 0 not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create table if not exists public."report_schedules" (
  "id" uuid default gen_random_uuid() not null,
  "report_type" character varying not null,
  "frequency" character varying not null,
  "day_of_week" integer,
  "time_of_day" character varying,
  "format" character varying default 'pdf'::character varying not null,
  "description" text,
  "email_recipients" text,
  "is_active" boolean default true not null,
  "next_run_at" timestamp without time zone,
  "last_run_at" timestamp without time zone,
  "created_by" character varying,
  "updated_by" character varying,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create table if not exists public."sessions" (
  "sid" character varying not null,
  "sess" jsonb not null,
  "expire" timestamp without time zone not null
);

create table if not exists public."system_alerts" (
  "id" uuid default gen_random_uuid() not null,
  "type" character varying not null,
  "severity" character varying not null,
  "title" character varying not null,
  "message" text not null,
  "user_id" character varying,
  "is_read" boolean default false not null,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

create table if not exists public."users" (
  "id" character varying not null,
  "email" character varying not null,
  "first_name" character varying,
  "last_name" character varying,
  "profile_image_url" character varying,
  "role" user_role default 'student'::user_role not null,
  "status" user_status default 'active'::user_status not null,
  "ban_reason" text,
  "ban_end_date" timestamp without time zone,
  "banned_at" timestamp without time zone,
  "two_factor_enabled" boolean default false,
  "two_factor_secret" character varying,
  "created_at" timestamp without time zone default now() not null,
  "updated_at" timestamp without time zone default now() not null
);

alter table public."activity_logs"
  drop constraint if exists "activity_logs_user_id_users_id_fk";
alter table public."activity_logs"
  add constraint "activity_logs_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id);
alter table public."activity_logs"
  drop constraint if exists "activity_logs_pkey";
alter table public."activity_logs"
  add constraint "activity_logs_pkey" PRIMARY KEY (id);

alter table public."booking_reminders"
  drop constraint if exists "booking_reminders_booking_id_facility_bookings_id_fk";
alter table public."booking_reminders"
  add constraint "booking_reminders_booking_id_facility_bookings_id_fk" FOREIGN KEY (booking_id) REFERENCES facility_bookings(id);
alter table public."booking_reminders"
  drop constraint if exists "booking_reminders_pkey";
alter table public."booking_reminders"
  add constraint "booking_reminders_pkey" PRIMARY KEY (id);
alter table public."booking_reminders"
  drop constraint if exists "booking_reminders_booking_id_unique";
alter table public."booking_reminders"
  add constraint "booking_reminders_booking_id_unique" UNIQUE (booking_id);

alter table public."campuses"
  drop constraint if exists "campuses_pkey";
alter table public."campuses"
  add constraint "campuses_pkey" PRIMARY KEY (id);
alter table public."campuses"
  drop constraint if exists "campuses_name_unique";
alter table public."campuses"
  add constraint "campuses_name_unique" UNIQUE (name);

alter table public."computer_stations"
  drop constraint if exists "computer_stations_pkey";
alter table public."computer_stations"
  add constraint "computer_stations_pkey" PRIMARY KEY (id);
alter table public."computer_stations"
  drop constraint if exists "computer_stations_name_unique";
alter table public."computer_stations"
  add constraint "computer_stations_name_unique" UNIQUE (name);

alter table public."equipment_inventory"
  drop constraint if exists "equipment_inventory_pkey";
alter table public."equipment_inventory"
  add constraint "equipment_inventory_pkey" PRIMARY KEY (id);
alter table public."equipment_inventory"
  drop constraint if exists "equipment_inventory_key_unique";
alter table public."equipment_inventory"
  add constraint "equipment_inventory_key_unique" UNIQUE (key);

alter table public."facilities"
  drop constraint if exists "facilities_campus_id_campuses_id_fk";
alter table public."facilities"
  add constraint "facilities_campus_id_campuses_id_fk" FOREIGN KEY (campus_id) REFERENCES campuses(id);
alter table public."facilities"
  drop constraint if exists "facilities_pkey";
alter table public."facilities"
  add constraint "facilities_pkey" PRIMARY KEY (id);

alter table public."facility_bookings"
  drop constraint if exists "facility_bookings_admin_id_users_id_fk";
alter table public."facility_bookings"
  add constraint "facility_bookings_admin_id_users_id_fk" FOREIGN KEY (admin_id) REFERENCES users(id);
alter table public."facility_bookings"
  drop constraint if exists "facility_bookings_facility_id_facilities_id_fk";
alter table public."facility_bookings"
  add constraint "facility_bookings_facility_id_facilities_id_fk" FOREIGN KEY (facility_id) REFERENCES facilities(id);
alter table public."facility_bookings"
  drop constraint if exists "facility_bookings_user_id_users_id_fk";
alter table public."facility_bookings"
  add constraint "facility_bookings_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id);
alter table public."facility_bookings"
  drop constraint if exists "facility_bookings_pkey";
alter table public."facility_bookings"
  add constraint "facility_bookings_pkey" PRIMARY KEY (id);

alter table public."faqs"
  drop constraint if exists "faqs_pkey";
alter table public."faqs"
  add constraint "faqs_pkey" PRIMARY KEY (id);

alter table public."report_schedules"
  drop constraint if exists "report_schedules_created_by_users_id_fk";
alter table public."report_schedules"
  add constraint "report_schedules_created_by_users_id_fk" FOREIGN KEY (created_by) REFERENCES users(id);
alter table public."report_schedules"
  drop constraint if exists "report_schedules_updated_by_users_id_fk";
alter table public."report_schedules"
  add constraint "report_schedules_updated_by_users_id_fk" FOREIGN KEY (updated_by) REFERENCES users(id);
alter table public."report_schedules"
  drop constraint if exists "report_schedules_pkey";
alter table public."report_schedules"
  add constraint "report_schedules_pkey" PRIMARY KEY (id);

alter table public."sessions"
  drop constraint if exists "sessions_pkey";
alter table public."sessions"
  add constraint "sessions_pkey" PRIMARY KEY (sid);

alter table public."system_alerts"
  drop constraint if exists "system_alerts_user_id_users_id_fk";
alter table public."system_alerts"
  add constraint "system_alerts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id);
alter table public."system_alerts"
  drop constraint if exists "system_alerts_pkey";
alter table public."system_alerts"
  add constraint "system_alerts_pkey" PRIMARY KEY (id);

alter table public."users"
  drop constraint if exists "users_pkey";
alter table public."users"
  add constraint "users_pkey" PRIMARY KEY (id);
alter table public."users"
  drop constraint if exists "users_email_unique";
alter table public."users"
  add constraint "users_email_unique" UNIQUE (email);

CREATE UNIQUE INDEX booking_reminders_booking_id_unique ON public.booking_reminders USING btree (booking_id);

CREATE UNIQUE INDEX campuses_name_unique ON public.campuses USING btree (name);

CREATE UNIQUE INDEX computer_stations_name_unique ON public.computer_stations USING btree (name);

CREATE UNIQUE INDEX equipment_inventory_key_unique ON public.equipment_inventory USING btree (key);

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);
