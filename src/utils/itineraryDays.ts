export const MAX_ITINERARY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const clampEndDateToMaxDays = (
  startDate: string,
  endDate: string,
  maxDays = MAX_ITINERARY_DAYS,
): { endDate: string; wasClamped: boolean } => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || maxDays <= 0) {
    return { endDate, wasClamped: false };
  }

  const maxEnd = new Date(start.getTime() + (maxDays - 1) * DAY_MS);
  if (end.getTime() <= maxEnd.getTime()) {
    return { endDate, wasClamped: false };
  }

  return { endDate: toIsoDate(maxEnd), wasClamped: true };
};

export const getDayIndexesFromDateRange = (
  startDate?: string | null,
  endDate?: string | null,
  maxDays = MAX_ITINERARY_DAYS,
): number[] => {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end || maxDays <= 0 || end.getTime() < start.getTime()) {
    return [1];
  }

  const rawCount = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const count = Math.max(1, Math.min(rawCount, maxDays));
  return Array.from({ length: count }, (_, index) => index + 1);
};
