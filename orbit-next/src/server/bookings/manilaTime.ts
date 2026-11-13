const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const LIBRARY_OPEN_MINUTES = 7 * 60 + 30;
const LIBRARY_CLOSE_MINUTES = 19 * 60;

const manilaDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

export interface ManilaDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day" | "hour" | "minute",
): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Missing ${type} while formatting Asia/Manila date.`);
  }
  return Number(value);
}

export function getManilaDateParts(date: Date): ManilaDateParts {
  const parts = manilaDateTimeFormatter.formatToParts(date);
  return {
    year: getNumericPart(parts, "year"),
    month: getNumericPart(parts, "month"),
    day: getNumericPart(parts, "day"),
    hour: getNumericPart(parts, "hour"),
    minute: getNumericPart(parts, "minute"),
  };
}

export function isWithinManilaLibraryHours(date: Date): boolean {
  const { hour, minute } = getManilaDateParts(date);
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= LIBRARY_OPEN_MINUTES
    && minutesSinceMidnight <= LIBRARY_CLOSE_MINUTES;
}

export function isSameManilaDay(start: Date, end: Date): boolean {
  const startParts = getManilaDateParts(start);
  const endParts = getManilaDateParts(end);
  return startParts.year === endParts.year
    && startParts.month === endParts.month
    && startParts.day === endParts.day;
}

export function getManilaDayBounds(date: Date): { start: Date; end: Date } {
  const { year, month, day } = getManilaDateParts(date);
  const startOfDay = Date.UTC(year, month - 1, day) - MANILA_UTC_OFFSET_MS;
  const startOfNextDay = Date.UTC(year, month - 1, day + 1) - MANILA_UTC_OFFSET_MS;

  return {
    start: new Date(startOfDay),
    end: new Date(startOfNextDay - 1),
  };
}
