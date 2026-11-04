import { dayRangeInTz, dateKeyInTz, shiftDateKey } from '@/lib/dates';

/** The snooze lengths the UI offers (days). */
export const SNOOZE_DAYS = [1, 2, 3, 7];

/** Start of the local day `days` after today, in `tz`. */
export function snoozeTarget(now: Date, tz: string, days: number): Date {
  const [y, m, d] = shiftDateKey(dateKeyInTz(now, tz), days).split('-').map(Number);
  // Noon UTC on the target date always falls inside that local day, whatever the offset.
  return dayRangeInTz(new Date(Date.UTC(y, m - 1, d, 12)), tz).start;
}
