export interface FacilityAccessTarget {
  name?: string | null;
  allowedRoles?: readonly string[] | null;
}

export function isFacultyRestrictedFacilityName(name?: string | null): boolean {
  return /board\s*room|lounge/i.test(name ?? "");
}

export function getDefaultFacilityAllowedRoles(name?: string | null): string[] {
  return isFacultyRestrictedFacilityName(name)
    ? ["faculty", "admin"]
    : ["student", "faculty"];
}

export function isFacilityAllowedForRole(
  facility: FacilityAccessTarget,
  role?: string | null,
): boolean {
  if (role === "admin") return true;

  const allowedRoles = facility.allowedRoles;
  const isConfigured = Array.isArray(allowedRoles) && allowedRoles.length > 0;

  if (role === "faculty") {
    return isConfigured
      ? allowedRoles.includes("faculty") || allowedRoles.includes("student")
      : true;
  }

  if (role === "student") {
    return isConfigured
      ? allowedRoles.includes("student")
      : !isFacultyRestrictedFacilityName(facility.name);
  }

  return false;
}
