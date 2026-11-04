// Custom column types and value helpers, shared by the API routes, the table
// cells and import/export.
//
// Values live in Problem.customFields keyed by column NAME and are always strings:
//   text     → free text
//   select   → one of the column's options (canonical spelling)
//   date     → "YYYY-MM-DD"
//   checkbox → "true", or "" when unchecked
//   url      → absolute http(s) URL

export const COLUMN_TYPES = ['text', 'select', 'date', 'checkbox', 'url'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  select: 'Select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'Link',
};

export const MAX_COLUMN_NAME_LENGTH = 40;
export const MAX_SELECT_OPTIONS = 50;
export const MAX_OPTION_LENGTH = 40;
export const MAX_VALUE_LENGTH = 1000;
export const MAX_COLUMNS = 30;

export type CustomColumn = {
  id: string;
  name: string;
  type: ColumnType;
  options: string[];
  order: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });

export function isColumnType(v: unknown): v is ColumnType {
  return typeof v === 'string' && (COLUMN_TYPES as readonly string[]).includes(v);
}

/** Coerces a DB row (type String, options Json?) into a typed column. */
export function toCustomColumn(row: { id: string; name: string; type?: string | null; options?: unknown; order: number }): CustomColumn {
  const options = normalizeOptions(row.options);
  return {
    id: row.id,
    name: row.name,
    type: isColumnType(row.type) ? row.type : 'text',
    options: options.ok ? options.value : [],
    order: row.order,
  };
}

/** Trims and collapses whitespace; checks length and case-insensitive uniqueness against `existing`. */
export function validateColumnName(
  raw: unknown,
  existing: { id: string; name: string }[] = [],
  selfId?: string
): Result<string> {
  if (typeof raw !== 'string') return fail('Column name is required');
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return fail('Column name is required');
  if (name.length > MAX_COLUMN_NAME_LENGTH) {
    return fail(`Column name must be ${MAX_COLUMN_NAME_LENGTH} characters or fewer`);
  }
  const key = name.toLowerCase();
  const clash = existing.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === key);
  return clash ? fail(`A column named "${name}" already exists`) : ok(name);
}

/** Accepts an array or a comma/newline separated string; trims, drops blanks and case-insensitive dupes. */
export function normalizeOptions(raw: unknown): Result<string[]> {
  if (raw === null || raw === undefined) return ok([]);
  let items: unknown[];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === 'string') items = raw.split(/[\n,]/);
  else return fail('Options must be a list of text values');

  const options: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item !== 'string' && typeof item !== 'number') continue;
    const option = String(item).trim();
    if (!option) continue;
    if (option.length > MAX_OPTION_LENGTH) return fail(`Options must be ${MAX_OPTION_LENGTH} characters or fewer`);
    const key = option.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  if (options.length > MAX_SELECT_OPTIONS) {
    return fail(`A select column can have at most ${MAX_SELECT_OPTIONS} options`);
  }
  return ok(options);
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', '✓', '✔', 'checked', 'done', 'on']);
const FALSE_WORDS = new Set(['', 'false', 'no', 'n', '0', 'unchecked', 'off']);

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** Parses a user-entered date into "YYYY-MM-DD" (a calendar date, no timezone shift). */
export function parseDateValue(raw: string): string | null {
  const s = raw.trim();

  // ISO-ish: 2025-1-5, 2025-01-05, 2025-01-05T10:00Z
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? ymd(y, m, d) : null;
  }

  // a/b/yyyy (also . or -). Ambiguous dd/mm vs mm/dd: a first part > 12 means dd/mm, else mm/dd.
  const slashed = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slashed) {
    let [month, day] = [Number(slashed[1]), Number(slashed[2])];
    const year = Number(slashed[3]);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    return isRealDate(year, month, day) ? ymd(year, month, day) : null;
  }

  // Wordy dates the JS parser understands ("Jan 5 2025").
  const t = Date.parse(s);
  if (!Number.isNaN(t) && /[a-z]/i.test(s)) {
    const d = new Date(t);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

/** A normalised absolute http(s) URL (bare domains get https://), or null. */
export function parseUrlValue(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(s);
  if (!hasScheme) {
    if (!/^[\w-]+(\.[\w-]+)+/.test(s)) return null;
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Validates and normalises a value for a column type, returning the string to
 * store in customFields. Empty input is always valid ("" = cleared).
 */
export function parseCustomValue(
  column: Pick<CustomColumn, 'type' | 'options'>,
  raw: unknown
): Result<string> {
  if (raw === null || raw === undefined) return ok('');
  if (typeof raw === 'boolean' && column.type === 'checkbox') return ok(raw ? 'true' : '');
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
    return fail('Value must be text');
  }
  const s = String(raw).trim();

  switch (column.type) {
    case 'checkbox': {
      const word = s.toLowerCase();
      if (TRUE_WORDS.has(word)) return ok('true');
      if (FALSE_WORDS.has(word)) return ok('');
      return fail('Use yes/no or true/false');
    }
    case 'select': {
      if (!s) return ok('');
      const match = column.options.find((o) => o.toLowerCase() === s.toLowerCase());
      return match ? ok(match) : fail(`"${s}" is not one of the options`);
    }
    case 'date': {
      if (!s) return ok('');
      const date = parseDateValue(s);
      return date ? ok(date) : fail('Use a date like 2025-01-31');
    }
    case 'url': {
      if (!s) return ok('');
      const url = parseUrlValue(s);
      return url ? ok(url) : fail('Enter a valid http(s) link');
    }
    default:
      return s.length > MAX_VALUE_LENGTH ? fail(`Text must be ${MAX_VALUE_LENGTH} characters or fewer`) : ok(s);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Human-readable text for a stored value. Unparseable values are shown as-is. */
export function formatCustomValue(column: Pick<CustomColumn, 'type'>, stored: unknown): string {
  if (stored === null || stored === undefined) return '';
  const s = String(stored);
  if (!s) return '';

  if (column.type === 'checkbox') return isChecked(s) ? 'Yes' : '';
  if (column.type === 'date') {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : s;
  }
  if (column.type === 'url') {
    try {
      const u = new URL(s);
      return (u.host + u.pathname).replace(/\/$/, '');
    } catch {
      return s;
    }
  }
  return s;
}

export function isChecked(stored: unknown): boolean {
  if (typeof stored === 'boolean') return stored;
  return TRUE_WORDS.has(String(stored ?? '').trim().toLowerCase());
}

/** Reads customFields JSON as a string map, ignoring nulls and non-objects. */
export function readCustomFields(json: unknown): Record<string, string> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    fields[key] = typeof value === 'string' ? value : String(value);
  }
  return fields;
}

/** A new map with `from` renamed to `to` (overwriting any old `to`), or null when nothing changes. */
export function renameFieldKey(fields: Record<string, string>, from: string, to: string): Record<string, string> | null {
  if (from === to || !(from in fields)) return null;
  const renamed: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === from) renamed[to] = value;
    else if (key !== to) renamed[key] = value;
  }
  return renamed;
}

/** A new map without `key`, or null when it wasn't there. */
export function removeFieldKey(fields: Record<string, string>, key: string): Record<string, string> | null {
  if (!(key in fields)) return null;
  const rest = { ...fields };
  delete rest[key];
  return rest;
}

/** Distinct non-empty values (first spelling wins), capped; used to seed select options. */
export function distinctValues(values: Iterable<string>, cap = MAX_SELECT_OPTIONS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const s = value.trim();
    const key = s.toLowerCase();
    if (!s || s.length > MAX_OPTION_LENGTH || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Moves `id` to `toIndex` (clamped); returns the ids in their new order. */
export function reorderIds(ids: string[], id: string, toIndex: number): string[] {
  if (!ids.includes(id)) return ids;
  const next = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(next.length, Math.trunc(toIndex)));
  next.splice(at, 0, id);
  return next;
}
