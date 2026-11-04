// Timezone-aware calendar-day helpers.
//
// Servers run in UTC, but a user's "today" is their local calendar day. The
// browser stores its IANA timezone in the `tz` cookie, and every API that
// groups by day (streak, heatmap, completed-today, undo) goes through these
// helpers so they all agree on where a day starts and ends.

export const TZ_COOKIE = 'tz';

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The user's timezone from the request's `tz` cookie, or UTC. Never throws. */
export function getRequestTimeZone(req: { cookies: { get(name: string): { value: string } | undefined } }): string {
  const raw = req.cookies.get(TZ_COOKIE)?.value;
  if (!raw) return 'UTC';
  let tz: string;
  try {
    tz = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding such as "%E0".
    return 'UTC';
  }
  return isValidTimeZone(tz) ? tz : 'UTC';
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

/** The wall-clock reading in `tz` at the instant `date`. */
function wallClock(date: Date, tz: string): WallClock {
  const out: Record<string, number> = {};
  for (const part of formatterFor(tz).formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return out as WallClock;
}

/** Offset of `tz` from UTC at the instant `date`, in minutes (+330 for Asia/Kolkata). */
function offsetMinutes(date: Date, tz: string): number {
  const w = wallClock(date, tz);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((wallAsUtc - wholeSeconds) / 60000);
}

/** UTC instant of local midnight at the start of y-m-d in `tz`. */
function localMidnight(y: number, m: number, d: number, tz: string): Date {
  const utcMidnight = Date.UTC(y, m - 1, d);
  const first = utcMidnight - offsetMinutes(new Date(utcMidnight), tz) * 60000;
  // Re-check the offset at the candidate instant, in case a DST change falls in between.
  const second = utcMidnight - offsetMinutes(new Date(first), tz) * 60000;
  return new Date(dateKeyInTz(new Date(second), tz) === toKey(y, m, d) ? second : first);
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseKey(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** "YYYY-MM-DD" of the calendar day `date` falls on in `tz`. */
export function dateKeyInTz(date: Date, tz: string): string {
  const w = wallClock(date, tz);
  return toKey(w.year, w.month, w.day);
}

/** UTC instants for the first and last millisecond of the local day containing `date`. */
export function dayRangeInTz(date: Date, tz: string): { start: Date; end: Date } {
  const key = dateKeyInTz(date, tz);
  const start = startOfDayKeyInTz(key, tz);
  const nextStart = startOfDayKeyInTz(shiftDateKey(key, 1), tz);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

/** Value for StreakLog.date (a @db.Date column): noon UTC of the user's local day. */
export function streakDateFor(date: Date, tz: string): Date {
  const [y, m, d] = parseKey(dateKeyInTz(date, tz));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Shift a "YYYY-MM-DD" key by whole days. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** UTC instant when the calendar day "YYYY-MM-DD" starts in `tz`. */
export function startOfDayKeyInTz(key: string, tz: string): Date {
  const [y, m, d] = parseKey(key);
  return localMidnight(y, m, d, tz);
}
