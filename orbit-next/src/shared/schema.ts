// Patch JSON.parse globally so bundled contexts (like Turbopack) handle
// database values such as "undefined" or "null" without throwing.
// This must run before pg/drizzle schemas import JSON values.
if (typeof JSON !== "undefined" && typeof JSON.parse === "function") {
  const originalParse = JSON.parse;
  JSON.parse = function (this: unknown, text: unknown, reviver?: any) {
    if (text === null || text === undefined) return null;
    const str = String(text).trim();
    if (
      str === "undefined" ||
      str === "null" ||
      str === "" ||
      str === '"undefined"' ||
      str === '"null"' ||
      str === '""'
    ) {
      return null;
    }
    try {
      return originalParse.call(this, text as any, reviver);
    } catch (err) {
      return null;
    }
  } as any;
}

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { ACADEMIC_PROGRAM_OPTIONS } from "./bookingRules";
import { FAQ_CATEGORIES, type FaqCategory } from "./faq";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
);

export const sessionsExpireIdx = index("IDX_session_expire").on(sessions.expire);

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["student", "faculty", "admin", "authorize_selga", "authorize_bonifacio"]);

// User status enum
export const userStatusEnum = pgEnum("user_status", ["active", "banned", "suspended"]);

// Booking edit status enum


// Users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("student").notNull(),
  status: userStatusEnum("status").default("active").notNull(),
  banReason: text("ban_reason"),
  banEndDate: timestamp("ban_end_date"),
  bannedAt: timestamp("banned_at"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Computer stations
export const computerStations = pgTable("computer_stations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  location: varchar("location").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ORZ computer sessions removed
// ORZ feature has been removed; type stubs are defined later to maintain compatibility.

// Campuses
export const campuses = pgTable("campuses", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  // disabledReason removed
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Facilities
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull(),
  image: varchar("image", { length: 255 }), // Path or filename for facility image
  isActive: boolean("is_active").default(true).notNull(),
  unavailableReason: text("unavailable_reason"),
  unavailableDates: jsonb("unavailable_dates").$type<Array<{ startDate: string; endDate: string; reason?: string }>>(),
  campusId: integer("campus_id").references(() => campuses.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  allowedRoles: varchar("allowed_roles").array().notNull().default(['student','faculty']),
});

// Facility bookings
export const facilityBookings = pgTable("facility_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  facilityId: integer("facility_id").references(() => facilities.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  purpose: text("purpose").notNull(),
  participants: integer("participants").notNull(),
  name: varchar("name", { length: 200 }),
  program: varchar("program", { length: 100 }),
  equipment: jsonb("equipment"),
  clientRequestId: uuid("client_request_id").unique(),
  declineReason: text("decline_reason"),
  cancellationReason: text("cancellation_reason"),
  rescheduleReason: text("reschedule_reason"),
  equipmentRequestStatus: varchar("equipment_request_status"),
  equipmentDeclineReason: text("equipment_decline_reason"),
  // Arrival confirmation: when an approved booking requires admin confirmation after start
  arrivalConfirmationDeadline: timestamp("arrival_confirmation_deadline"),
  arrivalConfirmed: boolean("arrival_confirmed").default(false),
  // Database status values: pending, approved, denied, cancelled
  // Note: "scheduled", "active", "done" are UI DISPLAY LABELS (not database values)
  // - "Scheduled" = approved booking that hasn't started yet (status='approved' + startTime > now)
  // - "Active" = approved booking currently in progress (status='approved' + now between start/end)
  // - "Done" = approved booking that has ended (status='approved' + endTime < now)
  status: varchar("status").default("pending").notNull(), // pending, approved, denied, cancelled
  adminId: varchar("admin_id").references(() => users.id),
  adminResponse: text("admin_response"),
  reminderOptIn: boolean("reminder_opt_in").default(true).notNull(),
  reminderStatus: varchar("reminder_status").default("pending").notNull(),
  reminderScheduledAt: timestamp("reminder_scheduled_at"),
  reminderLeadMinutes: integer("reminder_lead_minutes").default(60).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
});

export const bookingReminders = pgTable("booking_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").references(() => facilityBookings.id).notNull().unique(),
  reminderTime: timestamp("reminder_time").notNull(),
  status: varchar("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// System alerts
export const systemAlerts = pgTable("system_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type").notNull(), // security, system, user
  severity: varchar("severity").notNull(), // low, medium, high, critical
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  userId: varchar("user_id").references(() => users.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activity logs
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  details: text("details"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportSchedules = pgTable("report_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportType: varchar("report_type").notNull(),
  frequency: varchar("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  timeOfDay: varchar("time_of_day"),
  format: varchar("format").default("pdf").notNull(),
  description: text("description"),
  emailRecipients: text("email_recipients"),
  isActive: boolean("is_active").default(true).notNull(),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, (helpers) => ({
  facilityBookings: helpers.many(facilityBookings),
  systemAlerts: helpers.many(systemAlerts),
  activityLogs: helpers.many(activityLogs),
}));

export const computerStationsRelations = relations(computerStations, () => ({
  // ORZ sessions removed
}));

// ORZ relations removed

export const facilitiesRelations = relations(facilities, (helpers) => ({
  bookings: helpers.many(facilityBookings),
  campusRef: helpers.one(campuses, { fields: [facilities.campusId], references: [campuses.id] }),
}));

export const campusesRelations = relations(campuses, (helpers) => ({
  facilities: helpers.many(facilities),
}));

export const facilityBookingsRelations = relations(facilityBookings, (helpers) => ({
  facility: helpers.one(facilities, { fields: [facilityBookings.facilityId], references: [facilities.id] }),
  user: helpers.one(users, { fields: [facilityBookings.userId], references: [users.id] }),
  admin: helpers.one(users, { fields: [facilityBookings.adminId], references: [users.id] }),
}));

export const systemAlertsRelations = relations(systemAlerts, (helpers) => ({
  user: helpers.one(users, { fields: [systemAlerts.userId], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, (helpers) => ({
  user: helpers.one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

// Schemas for validation - using simplified approach to avoid drizzle-zod typing issues
export const insertUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  role: z.enum(["student", "faculty", "admin"]).default("student"),
  status: z.enum(["active", "banned", "suspended"]).default("active"),
  banReason: z.string().optional(),
  banEndDate: z.date().optional(),
  bannedAt: z.date().optional(),
  twoFactorEnabled: z.boolean().default(false),
  twoFactorSecret: z.string().optional(),
});

export const insertOrzSessionSchema = z.object({
  userId: z.string(),
  stationId: z.number(),
  plannedEndTime: z.date(),
  endTime: z.date().optional(),
  isActive: z.boolean().default(true),
  lastActivity: z.date().default(() => new Date()),
});

export const insertTimeExtensionRequestSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  requestedMinutes: z.number().positive(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "denied"]).default("pending"),
  adminId: z.string().optional(),
  adminResponse: z.string().optional(),
});

export const insertFacilityBookingSchema = z.object({
  facilityId: z.number(),
  userId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  purpose: z.string(),
  participants: z.number().positive(),
  name: z.string().trim().min(1, "Name is required").max(200),
  program: z.enum(ACADEMIC_PROGRAM_OPTIONS, {
    errorMap: () => ({ message: "Please select a valid academic program" }),
  }),
  equipment: z.any().optional(),
  clientRequestId: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "denied", "cancelled"]).default("pending"),
  adminId: z.string().optional(),
  adminResponse: z.string().optional(),
  declineReason: z.string().max(1000).nullable().optional(),
  cancellationReason: z.string().max(1000).nullable().optional(),
  rescheduleReason: z.string().max(1000).nullable().optional(),
  equipmentRequestStatus: z.enum(["pending", "approved", "denied"]).nullable().optional(),
  equipmentDeclineReason: z.string().max(1000).nullable().optional(),
  reminderOptIn: z.boolean().optional(),
  reminderLeadMinutes: z.number().int().min(5).max(1440).optional(),
});

export const createFacilityBookingSchema = insertFacilityBookingSchema;

export const insertSystemAlertSchema = z.object({
  type: z.string(),
  severity: z.string(),
  title: z.string(),
  message: z.string(),
  userId: z.string().optional(),
  isRead: z.boolean().default(false),
});

export const insertActivityLogSchema = z.object({
  action: z.string(),
  details: z.string().optional(),
  userId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export const insertReportScheduleSchema = z.object({
  reportType: z.string().min(1),
  frequency: z.string().min(1),
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .nullable()
    .optional(),
  timeOfDay: z.string().nullable().optional(),
  format: z.string().min(1).default("pdf"),
  description: z.string().nullable().optional(),
  emailRecipients: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  nextRunAt: z.date().nullable().optional(),
  lastRunAt: z.date().nullable().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: varchar("category").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  helpfulCount: integer("helpful_count").default(0).notNull(),
  notHelpfulCount: integer("not_helpful_count").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Equipment inventory - stores how many of each equipment type is available
export const equipmentInventory = pgTable("equipment_inventory", {
  id: serial("id").primaryKey(),
  key: varchar("key").notNull().unique(), // e.g. 'whiteboard', 'projector'
  label: varchar("label").notNull(),       // e.g. 'Whiteboard & Markers'
  totalCount: integer("total_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFaqSchema = z.object({
  category: z.custom<FaqCategory>((value) => typeof value === "string" && FAQ_CATEGORIES.includes(value as FaqCategory), {
    message: "Invalid FAQ category",
  }) as z.ZodType<FaqCategory>,
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export const updateFaqSchema = insertFaqSchema.partial();

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertOrzSession = z.infer<typeof insertOrzSessionSchema>;
export type OrzSession = any;
export type InsertTimeExtensionRequest = z.infer<typeof insertTimeExtensionRequestSchema>;
export type TimeExtensionRequest = any;
export type InsertFacilityBooking = z.infer<typeof insertFacilityBookingSchema>;
export type FacilityBooking = typeof facilityBookings.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
// Add Zod schema for facility insert/update with image
export const insertFacilitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  capacity: z.number().positive(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  unavailableReason: z.string().optional(),
  unavailableDates: z.any().optional(),
});
export type ComputerStation = typeof computerStations.$inferSelect;
export type SystemAlert = typeof systemAlerts.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = typeof reportSchedules.$inferInsert;
export type UpdateReportSchedule = Partial<Omit<ReportSchedule, "id" | "createdAt">>;
export type NormalizedInsertReportSchedule = Omit<InsertReportSchedule, "format"> & { format: string };
export type Faq = typeof faqs.$inferSelect;
export type EquipmentInventory = typeof equipmentInventory.$inferSelect;
export type Campus = typeof campuses.$inferSelect;
