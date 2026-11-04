// Pure validation and normalisation helpers for problem input, shared by the
// API routes and the add/edit UI. No server-only imports, so client code can use it.

import { getInitialSchedule } from '@/lib/scheduling';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_TITLE_LENGTH = 300;
export const MAX_CODE_LENGTH = 40;

// Slack for users in timezones ahead of the server clock.
const FUTURE_SLACK_MS = 14 * 60 * 60 * 1000;

const CF_URL_CODE = /(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/;
const CC_URL_CODE = /codechef\.com\/(?:[^/]+\/)?problems\/([A-Za-z0-9_]+)/i;

/** True for an absolute http(s) URL. */
export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Trims tags, collapses whitespace, drops empties and case-insensitive duplicates. */
export function normalizeTags(input: unknown): { tags: string[] } | { error: string } {
  const typeError = { error: 'tags must be an array of strings' };
  if (!Array.isArray(input)) return typeError;

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') return typeError;
    const tag = raw.trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return { error: `Each tag must be at most ${MAX_TAG_LENGTH} characters` };
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { error: `At most ${MAX_TAGS} tags per problem` };
  return { tags };
}

/** Parses a solve date; rejects invalid, pre-2000 and future dates. */
export function parseSolvedDate(input: unknown, now: Date = new Date()): { date: Date } | { error: string } {
  if (typeof input !== 'string' && typeof input !== 'number' && !(input instanceof Date)) {
    return { error: 'dateSolved must be a date' };
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return { error: 'dateSolved is not a valid date' };
  if (date.getTime() > now.getTime() + FUTURE_SLACK_MS) return { error: "Solve date can't be in the future" };
  if (date.getFullYear() < 2000) return { error: 'dateSolved is too far in the past' };
  return { date };
}

/**
 * First review = solve date + first ladder step, clamped to now: an old solve
 * date makes the problem due today rather than "overdue by weeks".
 */
export function initialScheduleFor(solvedAt: Date, ladder: readonly number[] | undefined, now: Date = new Date()) {
  const schedule = getInitialSchedule(solvedAt, ladder);
  return schedule.nextRevisionAt.getTime() < now.getTime()
    ? { ...schedule, nextRevisionAt: new Date(now) }
    : schedule;
}

/**
 * Stable number in [100000, 999998] for problems without a natural number, so
 * the (userId, platform, problemNumber) unique key doesn't collide on 0.
 */
export function hashToProblemNumber(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
    hash |= 0;
  }
  return 100000 + (Math.abs(hash) % 899999);
}

/**
 * "1234A" → 123401 (the scheme used by data/codeforces-problems.json). Split
 * problems get their own number ("1234C2" → 1234032) so C1 and C2 don't collide.
 */
export function codeforcesNumericId(code: string): number | null {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z])(\d?)$/);
  if (!m) return null;
  const base = parseInt(m[1], 10) * 100 + (m[2].charCodeAt(0) - 64);
  return m[3] ? base * 10 + parseInt(m[3], 10) : base;
}

/** Upper-cased platform code, or null for empty, too long, URL-like or spaced input. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim();
  if (!code || code.length > MAX_CODE_LENGTH || /^https?:/i.test(code) || /\s/.test(code)) return null;
  return code.toUpperCase();
}

/** Code for the number cell: the stored code, else one derived from the URL. */
export function displayCode(problem: { platform: string; code?: string | null; url?: string | null; problemNumber?: number }): string | null {
  if (problem.code) return problem.code;
  const url = problem.url ?? '';
  if (problem.platform === 'CODEFORCES') {
    const m = url.match(CF_URL_CODE);
    if (m) return `${m[1]}${m[2].toUpperCase()}`;
  }
  if (problem.platform === 'CODECHEF') {
    const m = url.match(CC_URL_CODE);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/** "YYYY-MM-DD" for a date in the runtime's local time. */
export function toLocalDateInput(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local "YYYY-MM-DD" → ISO string. Today keeps the current time (schedule from
 * now); earlier days use local noon so timezone offsets can't shift the day.
 */
export function localDateInputToISO(value: string, now: Date = new Date()): string {
  if (!value || value === toLocalDateInput(now)) return now.toISOString();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).toISOString();
}
