import { describe, expect, it } from "vitest";

import {
  getDefaultFacilityAllowedRoles,
  isFacilityAllowedForRole,
} from "../../shared/facilityAccess";

describe("facility role access", () => {
  it("uses facility defaults for regular rooms and faculty-restricted rooms", () => {
    expect(getDefaultFacilityAllowedRoles("Collaborative Learning Room 1")).toEqual(["student", "faculty"]);
    expect(getDefaultFacilityAllowedRoles("Boardroom")).toEqual(["faculty", "admin"]);
    expect(getDefaultFacilityAllowedRoles("Faculty Lounge")).toEqual(["faculty", "admin"]);
  });

  it("allows faculty to book regular and faculty-allowed facilities", () => {
    expect(isFacilityAllowedForRole({ name: "Study Room", allowedRoles: ["student"] }, "faculty")).toBe(true);
    expect(isFacilityAllowedForRole({ name: "Board Room", allowedRoles: ["faculty", "admin"] }, "faculty")).toBe(true);
    expect(isFacilityAllowedForRole({ name: "Study Room", allowedRoles: ["admin"] }, "faculty")).toBe(false);
  });

  it("uses configured roles as the source of truth for students", () => {
    expect(isFacilityAllowedForRole({ name: "Board Room", allowedRoles: ["student"] }, "student")).toBe(true);
    expect(isFacilityAllowedForRole({ name: "Study Room", allowedRoles: ["faculty"] }, "student")).toBe(false);
  });

  it("applies the name fallback only when allowedRoles is unconfigured", () => {
    expect(isFacilityAllowedForRole({ name: "Board Room", allowedRoles: [] }, "student")).toBe(false);
    expect(isFacilityAllowedForRole({ name: "Lounge" }, "student")).toBe(false);
    expect(isFacilityAllowedForRole({ name: "Board Room", allowedRoles: [] }, "faculty")).toBe(true);
    expect(isFacilityAllowedForRole({ name: "Study Room", allowedRoles: [] }, "student")).toBe(true);
  });

  it("allows admins to book every facility", () => {
    expect(isFacilityAllowedForRole({ name: "Board Room", allowedRoles: [] }, "admin")).toBe(true);
  });
});
