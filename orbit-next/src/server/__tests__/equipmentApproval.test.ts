import { describe, expect, it } from "vitest";
import { getEquipmentRequestDecision } from "@shared/equipmentApproval";
import { getEquipmentApprovalItems } from "@admin/lib/equipment";

describe("getEquipmentRequestDecision", () => {
  it("approves the request when every item is approved", () => {
    expect(getEquipmentRequestDecision(["approved", "approved"])).toBe("approved");
  });

  it("declines the request when every item is declined", () => {
    expect(getEquipmentRequestDecision(["declined", "declined"])).toBe("declined");
  });

  it("marks a fully decided mixed request as partially approved", () => {
    expect(getEquipmentRequestDecision(["approved", "declined"])).toBe("partially_approved");
  });

  it("keeps the request pending while any item is undecided", () => {
    expect(getEquipmentRequestDecision(["approved", "pending"])).toBe("pending");
  });

  it("keeps empty requests pending", () => {
    expect(getEquipmentRequestDecision([])).toBe("pending");
  });

  it("keeps individual equipment decisions distinct", () => {
    expect(getEquipmentApprovalItems({
      equipment: {
        items: ["whiteboard", "projector"],
        itemStatuses: { whiteboard: "approved", projector: "declined" },
        itemDeclineReasons: { projector: "Not available" },
      },
      equipmentRequestStatus: "partially_approved",
    })).toEqual([
      { key: "whiteboard", label: "Whiteboard & Markers", status: "approved" },
      { key: "projector", label: "Projector", status: "declined", declineReason: "Not available" },
    ]);
  });

  it("reads legacy booking-wide declined decisions", () => {
    expect(getEquipmentApprovalItems({
      equipment: { items: ["projector"] },
      equipmentRequestStatus: "denied",
    })[0].status).toBe("declined");
  });
});
