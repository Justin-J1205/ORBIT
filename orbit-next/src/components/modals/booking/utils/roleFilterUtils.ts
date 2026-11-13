/**
 * roleFilterUtils.ts
 * 
 * Utilities for filtering facilities based on user roles and access permissions.
 */

import { isFacilityAllowedForRole } from "@shared/facilityAccess";

export interface Facility {
  id: number;
  name: string;
  isActive: boolean;
  capacity: number;
  allowedRoles?: string[] | null;
}

export interface User {
  role?: string;
  email?: string;
}

/**
 * Filter facilities based on user role and facility restrictions
 */
export function filterFacilitiesByRole(facilities: Facility[], userRole?: string): Facility[] {
  return facilities.filter(facility => {
    if (!facility.isActive) return false;
    return isFacilityAllowedForRole(facility, userRole || "student");
  });
}

/**
 * Get predefined fallback facilities if API doesn't provide them
 */
export function getPredefinedFacilities(): Facility[] {
  return [
    { id: 1, name: "Collaborative Learning Room 1", isActive: true, capacity: 8, allowedRoles: ["student", "faculty"] },
    { id: 2, name: "Collaborative Learning Room 2", isActive: true, capacity: 8, allowedRoles: ["student", "faculty"] },
    { id: 3, name: "Board Room", isActive: true, capacity: 12, allowedRoles: ["faculty", "admin"] },
  ];
}

/**
 * Get facility description by name for display purposes
 */
export function getFacilityDescriptionByName(name?: string): string {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('collaborative learning room 1') || 
      lower.includes('collaborative learning room 2') || 
      lower.includes('collaborative learning')) {
    return 'Group study space (up to 8 people)';
  }
  if (lower.includes('board room') || lower.includes('boardroom')) {
    return 'Meeting room (up to 12 people)';
  }
  return 'Study space for individual or small groups';
}

/**
 * Check if a facility is a collaborative learning room
 */
export function isCollaborativeRoom(facilityName?: string): boolean {
  if (!facilityName) return false;
  const lower = facilityName.toLowerCase();
  return lower.includes('collaborative learning room');
}

/**
 * Get maximum duration for a facility (in milliseconds)
 */
export function getFacilityMaxDuration(facilityName?: string): number {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  
  if (isCollaborativeRoom(facilityName)) {
    return TWO_HOURS_MS;
  }
  return FOUR_HOURS_MS;
}
