export type EquipmentItemDecision = "pending" | "approved" | "declined";
export type EquipmentRequestDecision = EquipmentItemDecision | "partially_approved";

export function getEquipmentRequestDecision(
  itemStatuses: readonly EquipmentItemDecision[],
): EquipmentRequestDecision {
  if (itemStatuses.length === 0 || itemStatuses.some((status) => status === "pending")) {
    return "pending";
  }
  if (itemStatuses.every((status) => status === "approved")) return "approved";
  if (itemStatuses.every((status) => status === "declined")) return "declined";
  return "partially_approved";
}
