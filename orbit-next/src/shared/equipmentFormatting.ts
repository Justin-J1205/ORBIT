function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function getEquipmentItemNames(equipment: unknown): string[] {
  if (Array.isArray(equipment)) {
    return getStringItems(equipment);
  }

  if (!isRecord(equipment)) return [];

  if (Array.isArray(equipment.items)) return getStringItems(equipment.items);

  return Object.entries(equipment)
    .filter(([name, value]) => name !== "others" && name !== "items" && Boolean(value))
    .map(([name]) => name);
}
