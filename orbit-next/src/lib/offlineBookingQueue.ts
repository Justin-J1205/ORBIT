export interface OfflineBookingEntry {
  clientRequestId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

function getQueueKey(userId: string): string {
  return `orbit:offline-bookings:${encodeURIComponent(userId)}`;
}

export function readOfflineBookingQueue(userId: string): OfflineBookingEntry[] {
  const raw = window.localStorage.getItem(getQueueKey(userId));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("The saved offline booking queue is invalid. Clear the browser's site data before submitting again.");
  }
  return parsed.map((entry): OfflineBookingEntry => {
    if (
      !entry || typeof entry !== "object" ||
      typeof entry.clientRequestId !== "string" ||
      typeof entry.createdAt !== "string" ||
      !entry.payload || typeof entry.payload !== "object" || Array.isArray(entry.payload)
    ) {
      throw new Error("The saved offline booking queue contains an invalid entry. Clear the browser's site data before submitting again.");
    }
    return {
      clientRequestId: entry.clientRequestId,
      createdAt: entry.createdAt,
      payload: entry.payload as Record<string, unknown>,
    };
  });
}

export function enqueueOfflineBooking(userId: string, entry: OfflineBookingEntry): void {
  const queue = readOfflineBookingQueue(userId);
  if (!queue.some((queued) => queued.clientRequestId === entry.clientRequestId)) {
    queue.push(entry);
  }
  window.localStorage.setItem(getQueueKey(userId), JSON.stringify(queue));
}

export function removeOfflineBooking(userId: string, clientRequestId: string): void {
  const queue = readOfflineBookingQueue(userId);
  window.localStorage.setItem(
    getQueueKey(userId),
    JSON.stringify(queue.filter((entry) => entry.clientRequestId !== clientRequestId)),
  );
}
