import {
  users,
  facilityBookings,
  facilities,
  campuses,
  computerStations,
  systemAlerts,
  activityLogs,
  faqs,
  bookingReminders,
  reportSchedules,
  equipmentInventory,
  type User,
  type UpsertUser,
  type FacilityBooking,
  type InsertFacilityBooking,
  type Facility,
  type ComputerStation,
  type SystemAlert,
  type ActivityLog,
  type Faq,
  type EquipmentInventory,
  type Campus,
  createFacilityBookingSchema,
  insertFaqSchema,
  updateFaqSchema,
  insertReportScheduleSchema,
  userRoleEnum,
  userStatusEnum,
  type ReportSchedule,
  type InsertReportSchedule,
  type UpdateReportSchedule,
} from "@shared/schema";
import { db } from "@/server/config";
import { getDefaultFacilityAllowedRoles } from "@shared/facilityAccess";
import { getEquipmentRequestDecision, type EquipmentItemDecision } from "@shared/equipmentApproval";
import { eq, and, desc, asc, gte, lte, count, sql, isNotNull, or, lt, gt, ne } from "drizzle-orm";
import { z } from "zod";
import type { PostgresJsTransaction } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "@shared/schema";

type DbTransaction = PostgresJsTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  
  
  
  
  
  
  
  
            updateUserStatus(userId: string, status: typeof userStatusEnum.enumValues[number]): Promise<void>;
  banUser(userId: string, reason: string, banEndDate: Date | null): Promise<void>;
  unbanUser(userId: string): Promise<void>;
  updateUserRole(userId: string, role: typeof userRoleEnum.enumValues[number]): Promise<void>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  
  // ORZ Session operations removed
  
  // Time extension operations removed
  
  // Computer station operations
  getAllComputerStations(): Promise<ComputerStation[]>;
  getComputerStation(id: number): Promise<ComputerStation | undefined>;
  createComputerStation(station: { name: string; location: string; isActive?: boolean }): Promise<ComputerStation>;
  
  // Facility operations
  getAllFacilities(): Promise<Facility[]>;
  getFacility(id: number): Promise<Facility | undefined>;
  createFacility(facility: { name: string; description?: string; capacity: number; image?: string; campusId?: number; allowedRoles?: string[] }): Promise<Facility>;
  updateFacility(facilityId: number, updates: Partial<Facility>): Promise<void>;
  deleteFacility(id: number): Promise<void>;
  
  // Facility booking operations
  createFacilityBooking(booking: InsertFacilityBooking): Promise<FacilityBooking>;
  getFacilityBooking(id: string): Promise<FacilityBooking | undefined>;
  getFacilityBookingByClientRequestId(clientRequestId: string, userId: string): Promise<FacilityBooking | undefined>;
  updateFacilityBooking(id: string, updates: Partial<FacilityBooking>): Promise<void>;
  updateFacilityBookingWithActivity(id: string, updates: Partial<FacilityBooking>, activity: ActivityLog, expectedStatus?: string): Promise<void>;
  updateFacilityBookingEquipmentItemDecision(
    id: string,
    itemKey: string,
    status: "approved" | "declined",
    reason: string,
    activity: ActivityLog,
  ): Promise<FacilityBooking>;
  getAllFacilityBookings(): Promise<FacilityBooking[]>; // New function
  
  
  getFacilityBookingsByUser(userId: string): Promise<FacilityBooking[]>;
  // Check only approved bookings for conflicts (used when creating new pending requests)
  checkApprovedBookingConflicts(facilityId: number, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]>;
  checkUserOverlappingBookings(userId: string, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]>;
  // Check user bookings for any overlapping pending or approved bookings (across facilities)
  checkUserAnyOverlappingBookings(userId: string, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]>;
  // Check if user has any active booking (pending or approved) whose endTime is in the future
  checkUserHasActiveBooking(userId: string, excludeBookingId?: string): Promise<FacilityBooking[]>;
  cancelAllUserBookings(userId: string, adminId: string, reason: string): Promise<number>;
  getPendingFacilityBookings(): Promise<FacilityBooking[]>;
  getFacilityBookingsByDateRange(start: Date, end: Date): Promise<FacilityBooking[]>;
  
  // System alerts
  createSystemAlert(alert: SystemAlert): Promise<SystemAlert>;
  getSystemAlerts(): Promise<SystemAlert[]>;
  markAlertAsRead(id: string): Promise<number>;
  markAlertAsReadForUser(id: string, userId: string): Promise<number>;
  markAlertAsReadForAdmin(id: string): Promise<number>;
  updateSystemAlert(id: string, updates: Partial<SystemAlert>): Promise<SystemAlert | null>;
  
  // Activity logs
  createActivityLog(log: ActivityLog): Promise<ActivityLog>;
  getActivityLogs(userId?: string, limit?: number): Promise<ActivityLog[]>;

  // Report schedules
  getReportSchedules(): Promise<ReportSchedule[]>;
  getReportSchedule(id: string): Promise<ReportSchedule | undefined>;
  createReportSchedule(input: InsertReportSchedule): Promise<ReportSchedule>;
  updateReportSchedule(id: string, updates: UpdateReportSchedule): Promise<ReportSchedule | null>;
  deleteReportSchedule(id: string): Promise<void>;

  // FAQs
  getFaqs(): Promise<Faq[]>;
  createFaq(input: z.infer<typeof insertFaqSchema>): Promise<Faq>;
  updateFaq(id: string, input: z.infer<typeof updateFaqSchema>): Promise<Faq | null>;
  deleteFaq(id: string): Promise<void>;
  recordFaqFeedback(id: string, helpful: boolean): Promise<Faq | null>;

  // Equipment inventory
  getEquipmentInventory(): Promise<EquipmentInventory[]>;
  getEquipmentAvailability(startTime: Date, endTime: Date): Promise<Array<EquipmentInventory & { bookedCount: number }>>;
  upsertEquipmentInventory(key: string, label: string, totalCount: number): Promise<EquipmentInventory>;

  // Campus operations
  getAllCampuses(): Promise<Campus[]>;
  getActiveCampuses(): Promise<Campus[]>;
  getCampus(id: number): Promise<Campus | undefined>;
  createCampus(campus: { name: string; sortOrder?: number }): Promise<Campus>;
  updateCampus(id: number, updates: Partial<Campus>): Promise<Campus | null>;
  deleteCampus(id: number): Promise<void>;

  // Statistics
  getOrzUsageStats(): Promise<any>; // returns empty data now that ORZ is removed
  getFacilityUsageStats(): Promise<any>;
  getAdminDashboardStats(): Promise<any>;
  getFacilitiesByCampusId(campusId: number): Promise<Facility[]>;
  deleteFacilitiesByCampusId(campusId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const [newUser] = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({ target: users.id, set: user })
      .returning();
    return newUser;
  }

  async getUsersByRole(role: typeof userRoleEnum.enumValues[number]): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUserStatus(userId: string, status: typeof userStatusEnum.enumValues[number]): Promise<void> {
    await db.update(users).set({ status } as any).where(eq(users.id, userId));
  }

  async banUser(userId: string, reason: string, banEndDate: Date | null): Promise<void> {
    await db.update(users).set({ 
      status: "banned",
      banReason: reason,
      banEndDate: banEndDate,
      bannedAt: new Date()
    } as any).where(eq(users.id, userId));
  }

  async unbanUser(userId: string): Promise<void> {
    await db.update(users).set({ 
      status: "active",
      banReason: null,
      banEndDate: null,
      bannedAt: null
    } as any).where(eq(users.id, userId));
  }

  async updateUserRole(userId: string, role: typeof userRoleEnum.enumValues[number]): Promise<void> {
    await db.update(users).set({ role } as any).where(eq(users.id, userId));
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    return updatedUser;
  }

  // ORZ Session operations removed - provide safe fallbacks
  async createOrzSession(session: any): Promise<any> {
    // ORZ feature removed; return a placeholder object
    return null as any;
  }

  async getActiveOrzSession(userId: string): Promise<any | undefined> {
    // ORZ feature removed; always return undefined
    return undefined;
  }

  async updateOrzSession(sessionId: string, updates: Partial<any>): Promise<void> {
    // No-op
    return;
  }

  async endOrzSession(sessionId: string): Promise<void> {
    // No-op
    return;
  }

  async endAllUserSessions(userId: string): Promise<void> {
    // No-op
    return;
  }

  async getOrzSessionsByUser(userId: string): Promise<any[]> {
    return [];
  }

  async getAllActiveSessions(): Promise<any[]> {
    return [];
  }

  async getAllEndedSessions(): Promise<any[]> {
    return [];
  }

  async getOrzSession(id: string): Promise<any | undefined> {
    return undefined;
  }

  // Time extension operations removed - return safe defaults
  async createTimeExtensionRequest(request: any): Promise<any> {
    return null as any;
  }

  async getTimeExtensionRequest(id: string): Promise<any | undefined> {
    return undefined;
  }

  async updateTimeExtensionRequest(id: string, updates: Partial<any>): Promise<void> {
    return;
  }

  async getPendingTimeExtensionRequests(): Promise<any[]> {
    return [];
  }

  async deletePendingTimeExtensionRequestsBySession(sessionId: string): Promise<void> {
    return;
  }

  // Computer station operations
  async getAllComputerStations(): Promise<ComputerStation[]> {
    return db.select().from(computerStations);
  }

  async getComputerStation(id: number): Promise<ComputerStation | undefined> {
    const [station] = await db.select().from(computerStations).where(eq(computerStations.id, id));
    return station;
  }

  async createComputerStation(station: { name: string; location: string; isActive?: boolean }): Promise<ComputerStation> {
    const [newStation] = await db.insert(computerStations).values(station as any).returning();
    return newStation;
  }

  // Facility operations
  async getAllFacilities(): Promise<Facility[]> {
    return db.select().from(facilities).orderBy(asc(facilities.id));
  }

  async getFacility(id: number): Promise<Facility | undefined> {
    const [facility] = await db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async createFacility(facility: { name: string; description?: string; capacity: number; image?: string; campusId?: number; allowedRoles?: string[] }): Promise<Facility> {
    const [newFacility] = await db.insert(facilities).values({
      ...facility,
      allowedRoles: facility.allowedRoles ?? getDefaultFacilityAllowedRoles(facility.name),
    }).returning();
    return newFacility;
  }

  async updateFacility(facilityId: number, updates: Partial<Facility>): Promise<void> {
    // If unavailableDates is present, ensure it is saved as JSON
    const updateObj: any = { ...updates };
    if (updateObj.unavailableDates !== undefined) {
      updateObj.unavailableDates = JSON.stringify(updateObj.unavailableDates);
    }
    await db.update(facilities).set(updateObj).where(eq(facilities.id, facilityId));
  }

  // Facility booking operations
  // Application-level conflict error so callers can translate to 409
  public ConflictError = class ConflictError extends Error {
    public conflicts: FacilityBooking[];
    constructor(message: string, conflicts: FacilityBooking[] = []) {
      super(message);
      this.conflicts = conflicts;
      this.name = 'ConflictError';
    }
  };

  async createFacilityBooking(booking: InsertFacilityBooking): Promise<FacilityBooking> {
    // Run inside a DB transaction and obtain an advisory lock keyed by facility id to reduce race windows
    const facilityId = booking.facilityId;
    try {
      const result = await db.transaction(async (tx: DbTransaction) => {
        // Acquire advisory lock for this facility within the transaction
        // Note: drizzle's sql helper allows running raw SQL
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${facilityId})`);

        // Re-check for overlapping pending or approved bookings inside the transaction
        const now = new Date();
        const overlaps = await tx.select().from(facilityBookings).where(
          and(
            eq(facilityBookings.facilityId, facilityId),
            // Only check approved bookings
            eq(facilityBookings.status, "approved"),
            // Time overlap
            and(
              lt(facilityBookings.startTime, booking.endTime),
              gt(facilityBookings.endTime, booking.startTime)
            )
          )
        );

        if (Array.isArray(overlaps) && overlaps.length > 0) {
          // Throw a known ConflictError so route can translate to 409
          throw new (this.ConflictError)('Booking conflict detected', overlaps as FacilityBooking[]);
        }

        // No conflicts - insert booking
        const [created] = await tx.insert(facilityBookings).values(booking as any).returning();

        const reminderOptIn = booking.reminderOptIn !== false;
        if (booking.status === "approved" && reminderOptIn) {
          await this.upsertBookingReminder(tx as any, created.id, booking.reminderLeadMinutes ?? 60, booking.startTime);
        } else if (!reminderOptIn) {
          await tx
            .update(facilityBookings)
            .set({ reminderStatus: "skipped", reminderScheduledAt: null, reminderOptIn: false })
            .where(eq(facilityBookings.id, created.id));
        }

        return created;
      });
      return result as FacilityBooking;
    } catch (err: any) {
      // Re-throw ConflictError so callers can handle it
      if (err && err.name === 'ConflictError') throw err;
      console.error('❌ [STORAGE] createFacilityBooking failed:', err);
      throw err;
    }
  }

  async getFacilityBooking(id: string): Promise<FacilityBooking | undefined> {
    const [booking] = await db.select().from(facilityBookings).where(eq(facilityBookings.id, id));
    return booking;
  }

  async getFacilityBookingByClientRequestId(clientRequestId: string, userId: string): Promise<FacilityBooking | undefined> {
    const [booking] = await db.select().from(facilityBookings).where(
      and(
        eq(facilityBookings.clientRequestId, clientRequestId),
        eq(facilityBookings.userId, userId),
      )
    );
    return booking;
  }

  async updateFacilityBooking(id: string, updates: Partial<FacilityBooking>): Promise<void> {
    // Sanitize updates to prevent 'undefined' string or undefined/null in JSONB columns
    const safeUpdates = { ...updates };
    // Only sanitize equipment if present in updates
    if (Object.prototype.hasOwnProperty.call(safeUpdates, 'equipment')) {
      let eqVal = (safeUpdates as any).equipment;
      if (eqVal === undefined || eqVal === 'undefined' || eqVal === '' || eqVal === 'null' || eqVal === null) {
        (safeUpdates as any).equipment = null;
      }
    }
    try {
      if (safeUpdates && (safeUpdates as any).equipment) {
        try { console.log('[storage] updateFacilityBooking - writing equipment for booking', id, (safeUpdates as any).equipment); } catch (e) {}
      }
    } catch (e) {}
    await db.transaction(async (tx: DbTransaction) => {
      const [existing] = await tx.select().from(facilityBookings).where(eq(facilityBookings.id, id));
      if (!existing) return;

      await tx.update(facilityBookings).set(safeUpdates).where(eq(facilityBookings.id, id));

      const [updated] = await tx.select().from(facilityBookings).where(eq(facilityBookings.id, id));
      if (!updated) return;

      if ((safeUpdates as any).reminderOptIn === false) {
        await tx.delete(bookingReminders).where(eq(bookingReminders.bookingId, id));
        await tx
          .update(facilityBookings)
          .set({ reminderStatus: "skipped", reminderScheduledAt: null, reminderOptIn: false })
          .where(eq(facilityBookings.id, id));
        return;
      }

      const reminderOptIn = (safeUpdates as any).reminderOptIn ?? updated.reminderOptIn;
      if (!reminderOptIn) {
        await tx.delete(bookingReminders).where(eq(bookingReminders.bookingId, id));
        await tx
          .update(facilityBookings)
          .set({ reminderStatus: "skipped", reminderScheduledAt: null, reminderOptIn: false })
          .where(eq(facilityBookings.id, id));
        return;
      }

      if (reminderOptIn) {
        const leadMinutes = safeUpdates.reminderLeadMinutes ?? updated.reminderLeadMinutes ?? 60;
        const startTime = safeUpdates.startTime ?? updated.startTime;
        await this.upsertBookingReminder(tx as any, id, leadMinutes, startTime);
      }
    });
  }

  async updateFacilityBookingWithActivity(
    id: string,
    updates: Partial<FacilityBooking>,
    activity: ActivityLog,
    expectedStatus?: string,
  ): Promise<void> {
    await db.transaction(async (tx: DbTransaction) => {
      const [existing] = await tx.select().from(facilityBookings).where(eq(facilityBookings.id, id));
      if (!existing) throw new Error("Booking not found.");
      if (expectedStatus && existing.status !== expectedStatus) {
        throw new (this.ConflictError)("Booking status changed before the action could be applied.");
      }

      const lockFacilityIds = Array.from(new Set([existing.facilityId, updates.facilityId ?? existing.facilityId])).sort((a, b) => a - b);
      for (const facilityId of lockFacilityIds) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${facilityId})`);
      }

      const startTime = updates.startTime ?? existing.startTime;
      const endTime = updates.endTime ?? existing.endTime;
      const shouldCheckConflicts = updates.status === "approved"
        || updates.startTime !== undefined
        || updates.endTime !== undefined
        || updates.facilityId !== undefined;
      const facilityId = updates.facilityId ?? existing.facilityId;

      if (shouldCheckConflicts) {
        const conflicts = await tx.select().from(facilityBookings).where(
          and(
            eq(facilityBookings.facilityId, facilityId),
            eq(facilityBookings.status, "approved"),
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime),
            ne(facilityBookings.id, id),
          )
        );
        if (conflicts.length > 0) {
          throw new (this.ConflictError)("Booking conflicts with an approved reservation.", conflicts as FacilityBooking[]);
        }
      }

      await tx.update(facilityBookings).set(updates).where(eq(facilityBookings.id, id));
      if (updates.status === "denied" || updates.status === "cancelled") {
        await tx.delete(bookingReminders).where(eq(bookingReminders.bookingId, id));
        await tx.update(facilityBookings)
          .set({ reminderStatus: "skipped", reminderScheduledAt: null })
          .where(eq(facilityBookings.id, id));
      } else if (
        updates.status === "approved" ||
        updates.startTime !== undefined ||
        updates.reminderOptIn !== undefined ||
        updates.reminderLeadMinutes !== undefined
      ) {
        const reminderOptIn = updates.reminderOptIn ?? existing.reminderOptIn;
        if (reminderOptIn) {
          await this.upsertBookingReminder(
            tx as any,
            id,
            updates.reminderLeadMinutes ?? existing.reminderLeadMinutes,
            startTime,
          );
        } else {
          await tx.delete(bookingReminders).where(eq(bookingReminders.bookingId, id));
          await tx.update(facilityBookings)
            .set({ reminderStatus: "skipped", reminderScheduledAt: null, reminderOptIn: false })
            .where(eq(facilityBookings.id, id));
        }
      }
      await tx.insert(activityLogs).values(activity);
    });
  }

  async updateFacilityBookingEquipmentItemDecision(
    id: string,
    itemKey: string,
    status: "approved" | "declined",
    reason: string,
    activity: ActivityLog,
  ): Promise<FacilityBooking> {
    return db.transaction(async (tx: DbTransaction) => {
      const [existing] = await tx
        .select()
        .from(facilityBookings)
        .where(eq(facilityBookings.id, id))
        .for("update");
      if (!existing) throw new Error("Booking not found.");

      let equipmentValue = existing.equipment;
      if (typeof equipmentValue === "string") {
        try {
          equipmentValue = JSON.parse(equipmentValue);
        } catch {
          throw new Error("The equipment request could not be read.");
        }
      }
      if (!equipmentValue || typeof equipmentValue !== "object" || Array.isArray(equipmentValue)) {
        throw new Error("This booking has no equipment request.");
      }

      const equipment = { ...(equipmentValue as Record<string, unknown>) };
      const requestedItems = Array.isArray(equipment.items)
        ? equipment.items.map((item) => String(item ?? "").trim()).filter(Boolean)
        : Object.entries(equipment)
          .filter(([key, value]) => !["others", "itemStatuses", "itemDeclineReasons"].includes(key)
            && (value === true || value === "requested" || value === "prepared"))
          .map(([key]) => key);
      if (typeof equipment.others === "string" && equipment.others.trim()) {
        requestedItems.push("others");
      }
      if (!requestedItems.includes(itemKey)) {
        throw new (this.ConflictError)("The requested equipment item is no longer available for review.");
      }

      const itemStatuses = equipment.itemStatuses && typeof equipment.itemStatuses === "object"
        ? { ...(equipment.itemStatuses as Record<string, unknown>) }
        : {};
      const currentItemStatus = itemStatuses[itemKey]
        ?? (existing.equipmentRequestStatus === "approved" ? "approved"
          : existing.equipmentRequestStatus === "denied" || existing.equipmentRequestStatus === "declined" ? "declined"
            : "pending");
      if (currentItemStatus !== "pending") {
        throw new (this.ConflictError)("This equipment item has already been decided.");
      }
      itemStatuses[itemKey] = status;

      const itemDeclineReasons = equipment.itemDeclineReasons && typeof equipment.itemDeclineReasons === "object"
        ? { ...(equipment.itemDeclineReasons as Record<string, unknown>) }
        : {};
      if (status === "declined") itemDeclineReasons[itemKey] = reason;

      const statuses = requestedItems.map((key): EquipmentItemDecision => {
        if (key === itemKey) return status;
        const itemStatus = itemStatuses[key];
        return itemStatus === "approved" || itemStatus === "declined" ? itemStatus : "pending";
      });
      const equipmentRequestStatus = getEquipmentRequestDecision(statuses);

      equipment.itemStatuses = itemStatuses;
      equipment.itemDeclineReasons = itemDeclineReasons;
      await tx.update(facilityBookings)
        .set({
          equipment: equipment as FacilityBooking["equipment"],
          equipmentRequestStatus,
          equipmentDeclineReason: Object.keys(itemDeclineReasons).length > 0
            ? reason || existing.equipmentDeclineReason
            : null,
          adminId: activity.userId,
          updatedAt: new Date(),
        })
        .where(eq(facilityBookings.id, id));
      await tx.insert(activityLogs).values(activity);

      const [updated] = await tx.select().from(facilityBookings).where(eq(facilityBookings.id, id));
      if (!updated) throw new Error("The equipment decision was saved but the booking could not be reloaded.");
      return updated;
    });
  }

  private async upsertBookingReminder(
    client: Pick<typeof db, "insert" | "update" | "delete">,
    bookingId: string,
    leadMinutes: number,
    startTime: Date,
  ) {
    const reminderTime = new Date(startTime.getTime() - leadMinutes * 60 * 1000);
    if (reminderTime.getTime() <= Date.now()) {
      await client
        .update(facilityBookings)
        .set({ reminderStatus: "skipped", reminderScheduledAt: null, reminderLeadMinutes: leadMinutes })
        .where(eq(facilityBookings.id, bookingId));
      await client.delete(bookingReminders).where(eq(bookingReminders.bookingId, bookingId));
      return;
    }

    await client
      .insert(bookingReminders)
      .values({ bookingId, reminderTime, status: "pending" })
      .onConflictDoUpdate({
        target: bookingReminders.bookingId,
        set: {
          reminderTime,
          status: "pending",
          attempts: 0,
          lastAttemptAt: null,
          updatedAt: new Date(),
        },
      });

    await client
      .update(facilityBookings)
      .set({ reminderStatus: "scheduled", reminderScheduledAt: reminderTime, reminderLeadMinutes: leadMinutes, reminderOptIn: true })
      .where(eq(facilityBookings.id, bookingId));
  }

  async markReminderSent(bookingId: string) {
    await db.update(facilityBookings).set({ reminderStatus: "sent", reminderScheduledAt: null, updatedAt: new Date() }).where(eq(facilityBookings.id, bookingId));
    await db.update(bookingReminders).set({ status: "sent", lastAttemptAt: new Date(), updatedAt: new Date() }).where(eq(bookingReminders.bookingId, bookingId));
  }

  async deleteBookingReminder(bookingId: string) {
    await db.delete(bookingReminders).where(eq(bookingReminders.bookingId, bookingId));
  }

  async getAllFacilityBookings(): Promise<FacilityBooking[]> {
    try {
      // Explicitly select all columns to ensure admin_response is included
      const bookings = await db.select({
        id: facilityBookings.id,
        facilityId: facilityBookings.facilityId,
        userId: facilityBookings.userId,
        startTime: facilityBookings.startTime,
        endTime: facilityBookings.endTime,
        purpose: facilityBookings.purpose,
        participants: facilityBookings.participants,
        name: facilityBookings.name,
        program: facilityBookings.program,
        equipment: facilityBookings.equipment,
        clientRequestId: facilityBookings.clientRequestId,
        declineReason: facilityBookings.declineReason,
        cancellationReason: facilityBookings.cancellationReason,
        rescheduleReason: facilityBookings.rescheduleReason,
        equipmentRequestStatus: facilityBookings.equipmentRequestStatus,
        equipmentDeclineReason: facilityBookings.equipmentDeclineReason,
        arrivalConfirmationDeadline: facilityBookings.arrivalConfirmationDeadline,
        arrivalConfirmed: facilityBookings.arrivalConfirmed,
        status: facilityBookings.status,
        adminId: facilityBookings.adminId,
        adminResponse: facilityBookings.adminResponse,
        reminderOptIn: facilityBookings.reminderOptIn,
        reminderStatus: facilityBookings.reminderStatus,
        reminderScheduledAt: facilityBookings.reminderScheduledAt,
        reminderLeadMinutes: facilityBookings.reminderLeadMinutes,
        createdAt: facilityBookings.createdAt,
        updatedAt: facilityBookings.updatedAt,
      }).from(facilityBookings).orderBy(desc(facilityBookings.createdAt));
      // Sanitize equipment field in case database has string "undefined" or invalid JSON
      return bookings.map((booking: any) => {
        if (typeof booking.equipment === "string") {
          const trimmed = booking.equipment.trim();
          if (trimmed === "undefined" || trimmed === "null" || trimmed === "") {
            booking.equipment = null;
          } else {
            try {
              booking.equipment = JSON.parse(trimmed);
            } catch (e) {
              booking.equipment = null;
            }
          }
        }
        return booking;
      });
    } catch (error) {
      console.error("❌ [STORAGE] getAllFacilityBookings failed:", error);
      throw error;
    }
  }

  async getFacilityBookingsByUser(userId: string): Promise<FacilityBooking[]> {
    return db.select().from(facilityBookings).where(eq(facilityBookings.userId, userId)).orderBy(desc(facilityBookings.createdAt));
  }

  async checkApprovedBookingConflicts(facilityId: number, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]> {
    let query = db.select().from(facilityBookings)
      .where(
        and(
          eq(facilityBookings.facilityId, facilityId),
          // Only check approved bookings
          eq(facilityBookings.status, "approved"),
          // Time overlap
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          )
        )
      );

    if (excludeBookingId) {
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.facilityId, facilityId),
          eq(facilityBookings.status, "approved"),
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          ),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async checkBookingConflicts(facilityId: number, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]> {
    let query = db.select().from(facilityBookings)
      .where(
        and(
          eq(facilityBookings.facilityId, facilityId),
          // Only check approved bookings that are not cancelled
          or(
            eq(facilityBookings.status, "approved"),
            eq(facilityBookings.status, "pending")
          ),
          // Check for time overlap: new booking overlaps with existing if:
          // new start < existing end AND new end > existing start
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          )
        )
      );

    if (excludeBookingId) {
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.facilityId, facilityId),
          or(
            eq(facilityBookings.status, "approved"),
            eq(facilityBookings.status, "pending")
          ),
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          ),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async checkUserOverlappingBookings(userId: string, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]> {
    let query = db.select().from(facilityBookings)
      .where(
        and(
          eq(facilityBookings.userId, userId),
          // Only check approved (scheduled/active) bookings for overlap
          eq(facilityBookings.status, "approved"),
          // Check for time overlap: new booking overlaps with existing if:
          // new start < existing end AND new end > existing start
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          )
        )
      );

    if (excludeBookingId) {
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.userId, userId),
          eq(facilityBookings.status, "approved"),
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          ),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async checkUserAnyOverlappingBookings(userId: string, startTime: Date, endTime: Date, excludeBookingId?: string): Promise<FacilityBooking[]> {
    // Check for both pending and approved bookings for this user that overlap the requested time
    let query = db.select().from(facilityBookings)
      .where(
        and(
          eq(facilityBookings.userId, userId),
          or(eq(facilityBookings.status, "approved"), eq(facilityBookings.status, "pending")),
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          )
        )
      );

    if (excludeBookingId) {
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.userId, userId),
          or(eq(facilityBookings.status, "approved"), eq(facilityBookings.status, "pending")),
          and(
            lt(facilityBookings.startTime, endTime),
            gt(facilityBookings.endTime, startTime)
          ),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async checkUserHasActiveBooking(userId: string, excludeBookingId?: string): Promise<FacilityBooking[]> {
    const now = new Date();
    let query = db.select().from(facilityBookings).where(
      and(
        eq(facilityBookings.userId, userId),
        or(eq(facilityBookings.status, 'approved'), eq(facilityBookings.status, 'pending')),
        gt(facilityBookings.endTime, now)
      )
    );

    if (excludeBookingId) {
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.userId, userId),
          or(eq(facilityBookings.status, 'approved'), eq(facilityBookings.status, 'pending')),
          gt(facilityBookings.endTime, now),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async checkUserFacilityBookings(userId: string, facilityId: number, excludeBookingId?: string): Promise<FacilityBooking[]> {
    // Only consider bookings that are still active (approved or pending) AND whose endTime is in the future.
    // This allows users to create a new booking for the same facility after their previous booking has already ended.
    const now = new Date();
    let query = db.select().from(facilityBookings)
      .where(
        and(
          eq(facilityBookings.userId, userId),
          eq(facilityBookings.facilityId, facilityId),
          // Only check approved (scheduled/active) bookings
          eq(facilityBookings.status, "approved"),
          // Only consider bookings with endTime > now (still ongoing/future)
          gt(facilityBookings.endTime, now)
        )
      );

    if (excludeBookingId) {
      const nowEx = new Date();
      query = db.select().from(facilityBookings).where(
        and(
          eq(facilityBookings.userId, userId),
          eq(facilityBookings.facilityId, facilityId),
          eq(facilityBookings.status, "approved"),
          gt(facilityBookings.endTime, nowEx),
          ne(facilityBookings.id, excludeBookingId)
        )
      );
    }

    return query;
  }

  async cancelAllUserBookings(userId: string, adminId: string, reason: string): Promise<number> {
    // Cancel all bookings that are not already cancelled or denied
    // This includes pending and approved bookings
    const result = await db.update(facilityBookings)
      .set({ 
        status: "cancelled",
        adminId: adminId,
        adminResponse: `Booking cancelled due to user ban. Reason: ${reason}`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(facilityBookings.userId, userId),
          sql`${facilityBookings.status} IN ('pending', 'approved')`
        )
      );

    // Return the number of cancelled bookings
    return result.count || 0;
  }

  async getPendingFacilityBookings(): Promise<FacilityBooking[]> {
    return db.select().from(facilityBookings).where(eq(facilityBookings.status, "pending")).orderBy(desc(facilityBookings.createdAt));
  }

  async getFacilityBookingsByDateRange(start: Date, end: Date): Promise<FacilityBooking[]> {
    return db.select().from(facilityBookings).where(and(gte(facilityBookings.startTime, start), lte(facilityBookings.endTime, end))).orderBy(desc(facilityBookings.createdAt));
  }

  // System alerts
  async createSystemAlert(alert: SystemAlert): Promise<SystemAlert> {
    try {
      try { console.log('[storage][DEBUG] createSystemAlert called title="' + String(alert.title) + '" userId=' + String(alert.userId)); } catch (e) {}
      // Normalization helper: extract first meaningful line and strip noisy timestamps
      const normalizeFirstLine = (text: string | undefined) => {
        try {
          const raw = String(text || '');
          const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const first = lines.length > 0 ? lines[0] : '';
          // Remove common date/time patterns (MM/DD/YYYY, YYYY-MM-DD, HH:MM:SS, AM/PM)
          return first.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '')
                      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?\b/g, '')
                      .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, '')
                      .replace(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/gi, '')
                      .replace(/\s{2,}/g, ' ')
                      .replace(/^(An admin updated the equipment request at[:\s]*)/i, '')
                      .trim();
        } catch (e) { return String(text || '').trim(); }
      };

      // Skip deduplication for booking and equipment notifications 
      // to ensure each booking/equipment request gets its own notification
      // Keep booking lifecycle notifications distinct so approval and decision messages are not deduplicated.
      const skipDedup = alert.title === 'Booking Created' || 
                        alert.title === 'Booking Scheduled' || 
                        alert.title === 'Equipment Needs Submitted' ||
                        alert.title === 'Equipment or Needs Request';
      
      if (!skipDedup) {
        // Choose a lookback window: admin/global alerts get a longer window
        const FIVE_MIN = 5 * 60 * 1000;
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const lookbackMs = alert.userId == null ? ONE_DAY : FIVE_MIN;
        const cutoff = new Date(Date.now() - lookbackMs);

        // Build user filter: match same userId (including NULL for global/admin)
        const userCondition = alert.userId == null ? sql`${systemAlerts.userId} IS NULL` : eq(systemAlerts.userId, alert.userId as any);

        // Find recent candidate alerts with same title and user scope
        const candidates: SystemAlert[] = await db.select().from(systemAlerts).where(
          and(
            eq(systemAlerts.title, alert.title as any),
            userCondition,
            gte(systemAlerts.createdAt, cutoff as any)
          )
        ).orderBy(desc(systemAlerts.createdAt));

        const incomingKey = normalizeFirstLine(alert.message);
        for (const cand of (candidates || [])) {
          const candKey = normalizeFirstLine(cand.message as any);
          if (candKey && candKey === incomingKey) {
            // Found a near-duplicate: update existing alert's message and updatedAt, return it
            try {
              const [updated] = await db.update(systemAlerts).set({ message: alert.message, updatedAt: new Date() } as any).where(eq(systemAlerts.id, cand.id)).returning();
              try { console.log('[storage][DEBUG] createSystemAlert deduped to existing id=' + String(cand.id)); } catch (e) {}
              return updated || cand;
            } catch (e) {
              // If update fails, fall back to inserting a new alert below
              console.warn('[storage][WARN] Failed to update existing alert during dedupe, proceeding to insert new alert', e);
              break;
            }
          }
        }
      }

      // No duplicate found -> insert new alert
      const [newAlert] = await db.insert(systemAlerts).values(alert as any).returning();
      try { console.log('[storage][DEBUG] createSystemAlert inserted id=' + String(newAlert?.id) + ' userId=' + String(newAlert?.userId)); } catch (e) {}
      return newAlert;
    } catch (e) {
      console.error('[storage][ERROR] createSystemAlert failed for title="' + String(alert.title) + '" userId=' + String(alert.userId), e);
      throw e;
    }
  }

  async getSystemAlerts(): Promise<SystemAlert[]> {
    // Order alerts by most-recent activity: prefer updatedAt when present, otherwise createdAt
    try {
  // Use raw COALESCE on column names to avoid type-level references to generated column objects
  // Await the query so any DB errors (e.g. missing column) are caught and handled below.
  return await db.select().from(systemAlerts).orderBy(desc(sql`COALESCE(system_alerts.updated_at, system_alerts.created_at)`));
    } catch (e) {
      // Fallback for drivers that may not support COALESCE in this helper
      return await db.select().from(systemAlerts).orderBy(desc(systemAlerts.createdAt));
    }
  }

  async markAlertAsRead(id: string): Promise<number> {
    const result = await db.update(systemAlerts).set({ isRead: true }).where(eq(systemAlerts.id, id));
    return result.count || 0;
  }

  // Mark an alert as read only if it belongs to the specified user.
  async markAlertAsReadForUser(id: string, userId: string): Promise<number> {
    const result = await db.update(systemAlerts).set({ isRead: true }).where(and(eq(systemAlerts.id, id), eq(systemAlerts.userId, userId)));
    return result.count || 0;
  }

  // Mark a global/admin alert as read (only when userId IS NULL). Intended for admin routes.
  async markAlertAsReadForAdmin(id: string): Promise<number> {
    // Admin can mark any alert as read (both global alerts and user-specific equipment/needs alerts)
    const result = await db.update(systemAlerts).set({ isRead: true }).where(eq(systemAlerts.id, id));
    return result.count || 0;
  }

  async updateSystemAlert(id: string, updates: Partial<SystemAlert>): Promise<SystemAlert | null> {
    // Ensure updatedAt is set so updated alerts surface in admin lists ordered by recent activity
    const toUpdate = { ...(updates as any) };
    if (!toUpdate.updatedAt) toUpdate.updatedAt = new Date();
    const [updated] = await db.update(systemAlerts).set(toUpdate as any).where(eq(systemAlerts.id, id)).returning();
    return updated || null;
  }

  // Activity logs
  async createActivityLog(log: ActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log as any).returning();
    return newLog;
  }

  async getActivityLogs(userId?: string, limit = 50): Promise<ActivityLog[]> {
    let query = db.select().from(activityLogs);
    
    // Filter by userId if provided
    if (userId) {
      query = query.where(eq(activityLogs.userId, userId)) as any;
    }
    
    query = query.orderBy(desc(activityLogs.createdAt)) as any;
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  // Report schedules
  async getReportSchedules(): Promise<ReportSchedule[]> {
    return db.select().from(reportSchedules).orderBy(desc(reportSchedules.createdAt));
  }

  async getReportSchedule(id: string): Promise<ReportSchedule | undefined> {
    const [schedule] = await db.select().from(reportSchedules).where(eq(reportSchedules.id, id));
    return schedule;
  }

  async createReportSchedule(input: InsertReportSchedule): Promise<ReportSchedule> {
    const parsed = insertReportScheduleSchema.parse(input);
    const { emailRecipients, timeOfDay, ...rest } = parsed;

    const [created] = await db
      .insert(reportSchedules)
      .values({
        ...rest,
        emailRecipients: emailRecipients?.trim() || null,
        timeOfDay: timeOfDay?.trim() || null,
      } as InsertReportSchedule)
      .returning();
    return created;
  }

  async updateReportSchedule(id: string, updates: UpdateReportSchedule): Promise<ReportSchedule | null> {
    if (!updates || Object.keys(updates).length === 0) {
      const existing = await this.getReportSchedule(id);
      return existing ?? null;
    }

    const sanitized: UpdateReportSchedule = { ...updates };
    if (sanitized.emailRecipients !== undefined) {
      sanitized.emailRecipients = sanitized.emailRecipients?.trim() || null;
    }
    if (sanitized.timeOfDay !== undefined) {
      sanitized.timeOfDay = sanitized.timeOfDay?.trim() || null;
    }

    const toUpdate = Object.entries(sanitized).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        (acc as any)[key] = value;
      }
      return acc;
    }, {} as Partial<InsertReportSchedule>);

    if (Object.keys(toUpdate).length === 0) {
      const existing = await this.getReportSchedule(id);
      return existing ?? null;
    }

    const [updated] = await db
      .update(reportSchedules)
      .set({
        ...toUpdate,
        updatedAt: new Date(),
      } as any)
      .where(eq(reportSchedules.id, id))
      .returning();

    return updated ?? null;
  }

  async deleteReportSchedule(id: string): Promise<void> {
    await db.delete(reportSchedules).where(eq(reportSchedules.id, id));
  }

  async getFaqs(): Promise<Faq[]> {
    return db
      .select()
      .from(faqs)
      .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt));
  }

  async createFaq(input: z.infer<typeof insertFaqSchema>): Promise<Faq> {
    const parsed = insertFaqSchema.parse(input);
    const [faq] = await db
      .insert(faqs)
      .values({
        category: parsed.category,
        question: parsed.question,
        answer: parsed.answer,
        sortOrder: parsed.sortOrder ?? 0,
      })
      .returning();
    return faq;
  }

  async updateFaq(id: string, input: z.infer<typeof updateFaqSchema>): Promise<Faq | null> {
    const parsed = updateFaqSchema.parse(input);
    if (Object.keys(parsed).length === 0) {
      const [existing] = await db.select().from(faqs).where(eq(faqs.id, id));
      return existing ?? null;
    }
    const [updated] = await db
      .update(faqs)
      .set({
        ...parsed,
        updatedAt: new Date(),
      })
      .where(eq(faqs.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteFaq(id: string): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async recordFaqFeedback(id: string, helpful: boolean): Promise<Faq | null> {
    const column = helpful ? faqs.helpfulCount : faqs.notHelpfulCount;
    const [updated] = await db
      .update(faqs)
      .set({
        [helpful ? "helpfulCount" : "notHelpfulCount"]: sql`${column} + 1`,
        updatedAt: new Date(),
      } as any)
      .where(eq(faqs.id, id))
      .returning();
    return updated ?? null;
  }

  // Statistics
  async getOrzUsageStats(): Promise<any> {
    // Implement ORZ usage stats logic here
    return {};
  }

  async getFacilityUsageStats(): Promise<any> {
    // Implement facility usage stats logic here
    return {};
  }

  async getAdminDashboardStats(): Promise<any> {
    try {
  // ORZ removed -> no active ORZ session metric. Default to 0.
  const activeUsers = { count: 0 } as any;

      const [pendingBookings] = await db
        .select({ count: count() })
        .from(facilityBookings)
        .where(eq(facilityBookings.status, "pending"));

      const [systemAlertsCount] = await db
        .select({ count: count() })
        .from(systemAlerts)
        // Only count unread alerts that are global/admin (userId IS NULL) and of type 'booking'
        .where(and(
          eq(systemAlerts.isRead, false),
          eq(systemAlerts.type, 'booking'),
          sql`${systemAlerts.userId} IS NULL`
        ));

      const [bannedUsers] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.status, "banned"));

      return {
        activeUsers: activeUsers.count,
        pendingBookings: pendingBookings.count,
        systemAlerts: systemAlertsCount.count,
        bannedUsers: bannedUsers.count,
      };
    } catch (error) {
      console.error("❌ [STORAGE] Error fetching admin dashboard stats:", error);
      throw error; // Re-throw the error so it can be caught by the route handler
    }
  }

  // --- Equipment Inventory ---
  async getEquipmentInventory(): Promise<EquipmentInventory[]> {
    return db.select().from(equipmentInventory).orderBy(asc(equipmentInventory.key));
  }

  async getEquipmentAvailability(startTime: Date, endTime: Date): Promise<Array<EquipmentInventory & { bookedCount: number }>> {
    const inventory = await db.select().from(equipmentInventory).orderBy(asc(equipmentInventory.key));

    // Get all overlapping approved bookings that have equipment
    const overlapping = await db
      .select()
      .from(facilityBookings)
      .where(
        and(
          or(
            eq(facilityBookings.status, 'approved'),
            eq(facilityBookings.status, 'pending'),
          ),
          lt(facilityBookings.startTime, endTime),
          gt(facilityBookings.endTime, startTime),
          isNotNull(facilityBookings.equipment),
        )
      );

    // Count how many bookings have each equipment key
    const bookedCounts: Record<string, number> = {};
    for (const booking of overlapping) {
      const equip = booking.equipment as any;
      if (!equip) continue;
      const items: string[] = Array.isArray(equip.items) ? equip.items : [];
      for (const item of items) {
        const k = String(item).toLowerCase().replace(/\s+/g, '_');
        bookedCounts[k] = (bookedCounts[k] ?? 0) + 1;
      }
    }

    return inventory.map(inv => ({ ...inv, bookedCount: bookedCounts[inv.key] ?? 0 }));
  }

  async upsertEquipmentInventory(key: string, label: string, totalCount: number): Promise<EquipmentInventory> {
    const existing = await db.select().from(equipmentInventory).where(eq(equipmentInventory.key, key));
    if (existing.length > 0) {
      await db.update(equipmentInventory)
        .set({ label, totalCount, updatedAt: new Date() })
        .where(eq(equipmentInventory.key, key));
      return (await db.select().from(equipmentInventory).where(eq(equipmentInventory.key, key)))[0];
    }
    const [row] = await db.insert(equipmentInventory).values({ key, label, totalCount }).returning();
    return row;
  }
  // Campus operations
  async getAllCampuses(): Promise<Campus[]> {
    return db.select().from(campuses).orderBy(asc(campuses.sortOrder), asc(campuses.id));
  }

  async getActiveCampuses(): Promise<Campus[]> {
    return db.select().from(campuses)
      .where(eq(campuses.isActive, true))
      .orderBy(asc(campuses.sortOrder), asc(campuses.id));
  }

  async getCampus(id: number): Promise<Campus | undefined> {
    const [campus] = await db.select().from(campuses).where(eq(campuses.id, id));
    return campus;
  }

  async createCampus(campus: { name: string; sortOrder?: number }): Promise<Campus> {
    const [newCampus] = await db.insert(campuses).values(campus as any).returning();
    return newCampus;
  }

  async updateCampus(id: number, updates: Partial<Campus>): Promise<Campus | null> {
    const [updated] = await db.update(campuses).set(updates).where(eq(campuses.id, id)).returning();
    return updated ?? null;
  }

  async deleteCampus(id: number): Promise<void> {
    await db.delete(campuses).where(eq(campuses.id, id));
  }

  async deleteFacility(id: number): Promise<void> {
    await db.delete(facilities).where(eq(facilities.id, id));
  }

  async getFacilitiesByCampusId(campusId: number): Promise<Facility[]> {
    return db.select().from(facilities).where(eq(facilities.campusId, campusId));
  }

  async deleteFacilitiesByCampusId(campusId: number): Promise<void> {
    await db.delete(facilities).where(eq(facilities.campusId, campusId));
  }
}

export const storage = new DatabaseStorage();