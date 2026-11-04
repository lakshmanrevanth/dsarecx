// Import pipeline shared by the import modal (client) and /api/problems/import (server):
// file parsing, column auto-mapping, row validation, scheduling strategies,
// JSON backup parsing (v1 + v2) and duplicate merge/overwrite rules.

import { getResolver } from './platforms';
import { addDays, getInitialSchedule, MASTERY_RECHECK_DAYS, normalizeLadder } from './scheduling';
import { isColumnType, normalizeOptions, readCustomFields, type ColumnType } from './custom-columns';
import { siteConfig } from '@/config/site';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RecallField =
  | 'title'
  | 'problemNumber'
  | 'platform'
  | 'difficulty'
  | 'topic'
  | 'url'
  | 'dateSolved'
  | 'notes'
  | 'code'
  | 'tags'
  | 'lists'
  | 'isFavorite'
  | 'status'
  | 'currentStep'
  | 'nextRevisionAt'
  | 'revisionCount'
  | 'skip'
  | `custom:${string}`;

// Limits shared by the modal and the import route.
export const MAX_IMPORT_ROWS = 2000;
export const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 15 * 1024 * 1024;
export const MAX_REVISIONS_PER_PROBLEM = 500;

/** Header names written by GET /api/export?format=csv, in order (custom columns follow). */
export const EXPORT_CSV_HEADERS: { header: string; field: RecallField }[] = [
  { header: 'Title', field: 'title' },
  { header: 'Platform', field: 'platform' },
  { header: 'Number', field: 'problemNumber' },
  { header: 'Code', field: 'code' },
  { header: 'Difficulty', field: 'difficulty' },
  { header: 'Topic', field: 'topic' },
  { header: 'Tags', field: 'tags' },
  { header: 'URL', field: 'url' },
  { header: 'Date Solved', field: 'dateSolved' },
  { header: 'Notes', field: 'notes' },
  { header: 'Status', field: 'status' },
  { header: 'Step', field: 'currentStep' },
  { header: 'Next Revision', field: 'nextRevisionAt' },
  { header: 'Revision Count', field: 'revisionCount' },
  { header: 'Favorite', field: 'isFavorite' },
  { header: 'Lists', field: 'lists' },
];

/** Fields that carry schedule state; when mapped, the "keep schedule" strategy becomes available. */
export const SCHEDULE_FIELDS: RecallField[] = ['status', 'currentStep', 'nextRevisionAt', 'revisionCount'];

export type Platform = 'LEETCODE' | 'CODEFORCES' | 'GFG' | 'HACKERRANK' | 'CODECHEF' | 'SYSTEM_DESIGN';

export type ParsedFile = {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
};

export type ColumnMapping = Record<string, RecallField>;

/** preserve = keep status/step/next revision from the file (backups, or CSVs exported by this app). */
export type ImportStrategy = 'staggered' | 'fresh' | 'archive' | 'preserve';

/** What to do when a problem (same platform + number) already exists. */
export type DuplicateStrategy = 'skip' | 'overwrite' | 'merge';

export type ProblemStatusValue = 'ACTIVE' | 'MASTERED' | 'RETIRED';

export type ImportedRevision = {
  revisedAt: string; // ISO
  confidence: 'CLEAN' | 'SHAKY' | 'STRUGGLED';
  type: 'REGULAR' | 'RECHECK';
  stepBefore: number;
  stepAfter: number;
};

export type ProcessedProblem = {
  platform: Platform;
  problemNumber: number;
  title: string;
  url: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  dateSolved: string; // ISO
  notes: string | null;
  customFields?: Record<string, string>;
  currentStep: number;
  nextRevisionAt: string; // ISO
  status: ProblemStatusValue;
  code?: string | null;
  tags?: string[];
  lists?: string[];
  isFavorite?: boolean;
  revisionCount?: number;
  revisions?: ImportedRevision[];
  /** Schedule as found in the file, used by the "preserve" strategy. */
  original?: { status: ProblemStatusValue; currentStep: number; nextRevisionAt: string; revisionCount?: number };
  /** Fields filled with defaults (not in the file); overwrite/merge leave those alone. */
  defaulted?: string[];
};

export type ImportColumnDef = { name: string; type: ColumnType; options: string[] };

export type ValidationResult = {
  valid: ProcessedProblem[];
  warnings: { row: number; message: string }[];
  errors: { row: number; message: string }[];
  skipped: { row: number; reason: string }[];
  customColumns: string[];
  /** Typed definitions for columns (from a backup); plain names in customColumns default to text. */
  columnDefs?: ImportColumnDef[];
  streakLogs?: { date: string; completed: boolean }[];
  /** The to-learn list from a backup, passed through as-is; the server validates each item. */
  studyItems?: Record<string, unknown>[];
};

export type ImportRequestBody = {
  problems: ProcessedProblem[];
  customColumns?: string[];
  columnDefs?: ImportColumnDef[];
  streakLogs?: { date: string; completed: boolean }[];
  studyItems?: Record<string, unknown>[];
  duplicateStrategy?: DuplicateStrategy;
};

// ─── File parsing ───────────────────────────────────────────────────────────

export function detectFileType(file: File): 'csv' | 'excel' | 'json' | 'unsupported' {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (name.endsWith('.json') || type === 'application/json') return 'json';
  if (name.endsWith('.csv') || type === 'text/csv' || type === 'application/csv') return 'csv';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  return 'unsupported';
}

/** Trims keys and values; drops blank-keyed cells and rows with no content at all. */
function cleanRows(rawRows: Record<string, unknown>[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const raw of rawRows) {
    const row: Record<string, string> = {};
    let hasContent = false;
    for (const [key, value] of Object.entries(raw)) {
      const k = key.trim();
      if (!k) continue;
      const v = value !== null && value !== undefined ? String(value).trim() : '';
      if (v) hasContent = true;
      row[k] = v;
    }
    if (hasContent) rows.push(row);
  }
  return rows;
}

const cleanHeaders = (headers: string[]) => headers.map((h) => h.trim()).filter(Boolean);

export async function parseCsvFile(file: File): Promise<ParsedFile> {
  const Papa = (await import('papaparse')).default;
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const rows = cleanRows(results.data as Record<string, unknown>[]);
        resolve({ headers: cleanHeaders(results.meta.fields || []), rows, totalRows: rows.length });
      },
      error: (error) => reject(error),
    });
  });
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return { headers: [], rows: [], totalRows: 0 };

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    raw: false,
    defval: '',
  });
  if (data.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const rows = cleanRows(data);
  return { headers: cleanHeaders(Object.keys(data[0])), rows, totalRows: rows.length };
}

// ─── Column auto-detection ──────────────────────────────────────────────────

/**
 * Heuristic header → field rules, tried in order. A rule only claims a header
 * when its field is still free; otherwise the header falls through to the next
 * rule. Number is checked before title so "problem number" isn't taken as a title.
 */
const HEADER_RULES: { field: RecallField; test: (h: string) => boolean }[] = [
  {
    field: 'problemNumber',
    test: (h) => /\b(number|no|#|id|s\.no|sno|sr|code)\b/i.test(h) || h === '#' || h.includes('problem #'),
  },
  { field: 'title', test: (h) => /\b(title|question|problem|name)\b/i.test(h) },
  { field: 'platform', test: (h) => /\b(platform|source|site|judge)\b/i.test(h) },
  { field: 'difficulty', test: (h) => /\b(difficulty|diff|level)\b/i.test(h) },
  { field: 'topic', test: (h) => /\b(topic|tag|tags|category|type|subject)\b/i.test(h) },
  { field: 'url', test: (h) => /\b(url|link|href|webpage)\b/i.test(h) },
  { field: 'dateSolved', test: (h) => /\b(date|solved|completed|when)\b/i.test(h) },
  { field: 'notes', test: (h) => /\b(note|notes|comment|comments|remark|remarks)\b/i.test(h) },
];

export function autoDetectMappings(
  headers: string[],
  existingCustomColumns: string[] = []
): Record<string, RecallField> {
  const mapping: Record<string, RecallField> = {};
  const assigned = new Set<RecallField>();
  const customByKey = new Map(existingCustomColumns.map((c) => [c.toLowerCase().trim(), c]));

  // Pass 1: exact matches for our own export headers, so exports round-trip.
  // A header that names an existing custom column is left for that column.
  const exportHeaders = new Map(EXPORT_CSV_HEADERS.map((e) => [e.header.toLowerCase(), e.field]));
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    const field = exportHeaders.get(h);
    if (field && !assigned.has(field) && !customByKey.has(h)) {
      mapping[header] = field;
      assigned.add(field);
    }
  }

  // Pass 2: heuristics, then existing custom columns, then a new custom column.
  for (const header of headers) {
    if (mapping[header]) continue;
    const h = header.toLowerCase().trim();

    const rule = HEADER_RULES.find((r) => !assigned.has(r.field) && r.test(h));
    if (rule) {
      mapping[header] = rule.field;
      assigned.add(rule.field);
      continue;
    }

    const existing = existingCustomColumns.find((c) => c.toLowerCase().trim() === h);
    if (existing !== undefined) {
      mapping[header] = `custom:${existing}`;
      continue;
    }

    const clean = header.trim();
    mapping[header] = clean ? `custom:${clean}` : 'skip';
  }

  return mapping;
}

// ─── Value normalisation ────────────────────────────────────────────────────

const EASY_WORDS = new Set(['easy', 'e', '1', 'simple', 'basic']);
const HARD_WORDS = new Set(['hard', 'h', '3', 'difficult', 'advanced', 'expert']);

/** Free-form difficulty text → EASY / MEDIUM / HARD. Anything unrecognised is MEDIUM. */
export function normalizeDifficulty(value?: string | null): 'EASY' | 'MEDIUM' | 'HARD' {
  if (!value) return 'MEDIUM';
  const v = value.trim().toLowerCase();
  if (EASY_WORDS.has(v) || v.startsWith('easy')) return 'EASY';
  if (HARD_WORDS.has(v) || v.startsWith('hard')) return 'HARD';
  return 'MEDIUM';
}

/** Like tryParseDate, but falls back to now. */
export function parseDate(value?: string | null): Date {
  return tryParseDate(value) ?? new Date();
}

const EXCEL_EPOCH_MS = new Date(1899, 11, 30).getTime();
const DAY_MS = 86_400_000;

/**
 * Parses dates as found in spreadsheets: Unix ms / seconds, Excel serial days,
 * anything Date.parse understands, and a/b/yyyy (US order unless a part > 12).
 * Returns null for empty or unrecognised input.
 */
export function tryParseDate(value?: string | null): Date | null {
  const s = value?.trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    const candidates: Date[] = [];
    if (n > 10_000_000_000) candidates.push(new Date(n)); // Unix ms
    if (n > 1_000_000_000) candidates.push(new Date(n * 1000)); // Unix seconds
    if (n >= 20000 && n <= 70000) candidates.push(new Date(EXCEL_EPOCH_MS + n * DAY_MS)); // Excel serial day
    const first = candidates.find((d) => validDate(d));
    if (first) return first;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed);

  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [a, b, year] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    if (a > 12 && b <= 12) return new Date(year, b - 1, a); // dd/mm
    return new Date(year, a - 1, b); // mm/dd
  }
  return null;
}

function validDate(d: Date): Date | undefined {
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function detectPlatformFromUrl(url?: string | null): Platform | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('leetcode.com')) return 'LEETCODE';
  if (lower.includes('codeforces.com')) return 'CODEFORCES';
  if (lower.includes('geeksforgeeks.org') || lower.includes('gfg')) return 'GFG';
  if (lower.includes('hackerrank.com')) return 'HACKERRANK';
  if (lower.includes('codechef.com')) return 'CODECHEF';
  return null;
}

const PLATFORM_ALIASES: Record<string, Platform> = {
  leetcode: 'LEETCODE',
  lc: 'LEETCODE',
  codeforces: 'CODEFORCES',
  cf: 'CODEFORCES',
  gfg: 'GFG',
  geeksforgeeks: 'GFG',
  hackerrank: 'HACKERRANK',
  hr: 'HACKERRANK',
  codechef: 'CODECHEF',
  cc: 'CODECHEF',
  systemdesign: 'SYSTEM_DESIGN',
  sd: 'SYSTEM_DESIGN',
};

/** "Leet Code", "cf", "system_design" → enum value, or null. */
export function normalizePlatform(value?: string | null): Platform | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return Object.prototype.hasOwnProperty.call(PLATFORM_ALIASES, key) ? PLATFORM_ALIASES[key] : null;
}

/** djb2 hash, non-negative. */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Title-cases each word; empty becomes "General". */
export function normalizeTopic(value?: string | null): string {
  const s = value?.trim();
  if (!s) return 'General';
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Absolute URLs pass; bare domains get https://; anything else becomes the '#' placeholder. */
export function normalizeUrl(value?: string | null): string {
  const s = value?.trim();
  if (!s) return '#';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (['.com', '.org', '.io', '.net'].some((tld) => s.includes(tld))) return `https://${s}`;
  return '#';
}

/** True when every (mapped) cell in the row is blank. */
export function isRowEmpty(row: Record<string, string>, mappedFields?: string[]): boolean {
  const blank = (v: string | undefined) => !v || !v.trim();
  if (mappedFields && mappedFields.length > 0) return mappedFields.every((f) => blank(row[f]));
  return Object.values(row).every(blank);
}

/** `batchSize` problems per day starting today: index 0..batchSize-1 → today, the next batch → tomorrow, ... */
export function computeStaggerSchedule(
  index: number,
  _totalProblems: number,
  today: Date,
  batchSize: number = 10
): Date {
  const target = new Date(today.getTime());
  target.setDate(target.getDate() + Math.floor(index / Math.max(1, batchSize)));
  return target;
}

// ─── Problem number extraction ──────────────────────────────────────────────

function lastPathSegment(url: string): string | undefined {
  return url.split('/').filter(Boolean).pop()?.toLowerCase();
}

/** Best-effort problem number from a URL (dataset lookups where possible, else a slug hash). */
export async function extractProblemNumberFromUrl(
  url: string,
  platform: Platform
): Promise<number | null> {
  if (!url || url === '#') return null;

  try {
    switch (platform) {
      case 'LEETCODE': {
        const m = url.match(/leetcode\.com\/problems\/([^/?#]+)/i);
        if (!m) return null;
        const slug = m[1].toLowerCase();
        try {
          const rows = (await import('../data/leetcode-problems.json')).default as any[];
          const hit = rows.find((p) => p.slug?.toLowerCase() === slug);
          if (hit?.id) return hit.id;
        } catch {
          /* dataset unavailable: fall back to the hash */
        }
        return hashString(slug);
      }
      case 'CODEFORCES': {
        const m = url.match(/codeforces\.com\/(?:problemset\/problem|contest)\/(\d+)\/([A-Za-z\d]+)/i);
        return m ? parseInt(m[1], 10) : null;
      }
      case 'CODECHEF': {
        const m = url.match(/codechef\.com\/(?:[^/]+\/)?problems\/([A-Za-z\d_]+)/i);
        if (!m) return null;
        const code = m[1].toUpperCase();
        try {
          const rows = (await import('../data/codechef-problems.json')).default as any[];
          const hit = rows.find((p) => p.code?.toUpperCase() === code);
          if (hit?.numericId) return hit.numericId;
        } catch {
          /* dataset unavailable: fall back to the hash */
        }
        return hashString(code);
      }
      case 'GFG': {
        const m = url.match(/geeksforgeeks\.org\/problems\/([^/?#]+)/i);
        const slug = m ? m[1].toLowerCase() : lastPathSegment(url);
        return slug ? hashString(slug) : null;
      }
      case 'HACKERRANK': {
        const m = url.match(/hackerrank\.com\/(?:contests\/[^/]+\/)?challenges\/([^/?#]+)/i);
        const slug = m ? m[1].toLowerCase() : lastPathSegment(url);
        return slug ? hashString(slug) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ─── Parsers for the round-trip fields ──────────────────────────────────────

const VALID_PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF', 'SYSTEM_DESIGN'];
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

export function parseStatus(value?: string | null): ProblemStatusValue | null {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'ACTIVE' || v === 'MASTERED' || v === 'RETIRED' ? v : null;
}

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'x', '★', '✓', 'favorite']);

export function parseBoolean(value?: string | null): boolean {
  return TRUTHY.has((value ?? '').trim().toLowerCase());
}

/** Splits "a; b | c" (and on commas when allowComma) into unique trimmed values. */
export function parseList(value?: string | null, allowComma = false, max = MAX_TAGS): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(allowComma ? /[;,|]/ : /[;|]/)) {
    const s = part.trim().slice(0, MAX_TAG_LENGTH);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Accepts ["a", "b"] or [{ name: "a" }] (v2 lists); anything else is ignored. */
function toStringList(value: unknown, max = MAX_TAGS): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .map((v) => (typeof v === 'string' ? v : typeof v?.name === 'string' ? v.name : ''))
    .filter(Boolean);
  return parseList(names.join(';'), false, max);
}

/** An integer ladder step 0-3, or null. */
function clampStep(n: unknown): number | null {
  const v = typeof n === 'number' ? n : typeof n === 'string' && n.trim() ? Number(n) : NaN;
  return Number.isInteger(v) && v >= 0 && v <= 3 ? v : null;
}

// ─── Scheduling strategies ──────────────────────────────────────────────────

export type ScheduleContext = {
  index: number; // position among valid problems
  today: Date;
  batchSize: number; // problems per day for staggered / archive rechecks
  ladder?: readonly number[];
};

/**
 * staggered: due from today, batchSize a day.
 * fresh:     first ladder step after the solve date, never in the past.
 * archive:   treated as mastered; one 90-day recheck, spread batchSize a day.
 * preserve:  the schedule from the file (fresh when the file has none).
 */
export function scheduleFor(
  strategy: ImportStrategy,
  dateSolved: Date,
  ctx: ScheduleContext,
  original?: ProcessedProblem['original']
): { currentStep: number; status: ProblemStatusValue; nextRevisionAt: Date } {
  const perDay = Math.max(1, ctx.batchSize);

  if (strategy === 'preserve' && original) {
    return {
      currentStep: original.currentStep,
      status: original.status,
      nextRevisionAt: new Date(original.nextRevisionAt),
    };
  }

  if (strategy === 'archive') {
    return {
      currentStep: 3,
      status: 'MASTERED',
      nextRevisionAt: addDays(ctx.today, MASTERY_RECHECK_DAYS + Math.floor(ctx.index / perDay)),
    };
  }

  if (strategy === 'fresh' || strategy === 'preserve') {
    const initial = getInitialSchedule(dateSolved, normalizeLadder(ctx.ladder));
    const next = initial.nextRevisionAt < ctx.today ? new Date(ctx.today) : initial.nextRevisionAt;
    return { currentStep: 0, status: 'ACTIVE', nextRevisionAt: next };
  }

  return {
    currentStep: 0,
    status: 'ACTIVE',
    nextRevisionAt: computeStaggerSchedule(ctx.index, 0, ctx.today, perDay),
  };
}

/** Re-applies a strategy to already-validated problems (backups pick the strategy after parsing). */
export function applyStrategy(
  result: ValidationResult,
  strategy: ImportStrategy,
  today: Date = new Date(),
  batchSize = 10,
  ladder?: readonly number[]
): ValidationResult {
  const valid = result.valid.map((p, index) => {
    const s = scheduleFor(strategy, new Date(p.dateSolved), { index, today, batchSize, ladder }, p.original);
    const keptCount = strategy === 'preserve' ? p.original?.revisionCount : undefined;
    return {
      ...p,
      currentStep: s.currentStep,
      status: s.status,
      nextRevisionAt: s.nextRevisionAt.toISOString(),
      revisionCount: keptCount !== undefined ? keptCount : p.revisions?.length ?? 0,
    };
  });
  return { ...result, valid };
}

export function hasScheduleData(result: ValidationResult): boolean {
  return result.valid.some((p) => !!p.original);
}

// ─── Row validation pipeline (CSV / Excel) ──────────────────────────────────

export async function validateAndProcessRows(
  parsedFile: ParsedFile,
  columnMapping: ColumnMapping,
  strategy: ImportStrategy,
  defaultPlatform: Platform = 'LEETCODE',
  today: Date = new Date(),
  batchSize: number = 10,
  ladder?: readonly number[]
): Promise<ValidationResult> {
  const valid: ProcessedProblem[] = [];
  const warnings: ValidationResult['warnings'] = [];
  const errors: ValidationResult['errors'] = [];
  const skipped: ValidationResult['skipped'] = [];

  // field → header, plus the custom-column headers.
  const headerFor: Partial<Record<RecallField, string>> = {};
  const customMappings: { header: string; column: string }[] = [];
  for (const [header, field] of Object.entries(columnMapping)) {
    if (field === 'skip') continue;
    headerFor[field] = header;
    if (field.startsWith('custom:')) {
      const column = field.slice('custom:'.length).trim();
      if (column) customMappings.push({ header, column });
    }
  }

  const customColumns = Array.from(new Set(customMappings.map((c) => c.column)));
  const mappedHeaders = Object.keys(columnMapping).filter((h) => columnMapping[h] !== 'skip');

  if (parsedFile.rows.length > MAX_IMPORT_ROWS) {
    errors.push({ row: 0, message: `Too many rows (${parsedFile.rows.length}). The limit is ${MAX_IMPORT_ROWS}.` });
    return { valid, warnings, errors, skipped, customColumns };
  }

  const seenKeys = new Set<string>();

  for (let i = 0; i < parsedFile.rows.length; i++) {
    const rowNum = i + 1;
    const row = parsedFile.rows[i];
    if (isRowEmpty(row, mappedHeaders)) continue;

    const get = (field: RecallField) => {
      const h = headerFor[field];
      return h ? (row[h] ?? '').trim() : '';
    };
    const warn = (message: string) => warnings.push({ row: rowNum, message: `Row ${rowNum}: ${message}` });
    const defaulted: string[] = [];

    const title = get('title');
    if (!title) {
      errors.push({ row: rowNum, message: `Row ${rowNum}: Missing required title` });
      skipped.push({ row: rowNum, reason: `Row ${rowNum}: Missing title` });
      continue;
    }

    const rawPlatform = get('platform');
    const rawDiff = get('difficulty');
    const rawTopic = get('topic');
    const rawUrl = get('url');
    const rawDate = get('dateSolved');
    const rawNumber = get('problemNumber');
    const rawNotes = get('notes');

    const platform: Platform =
      normalizePlatform(rawPlatform) ?? (rawUrl ? detectPlatformFromUrl(rawUrl) : null) ?? defaultPlatform;

    let difficulty = normalizeDifficulty(rawDiff);
    if (!rawDiff) {
      defaulted.push('difficulty');
      warn('Missing difficulty, defaulted to Medium');
    }

    let topic = normalizeTopic(rawTopic);
    if (!rawTopic) {
      defaulted.push('topic');
      warn('Missing topic, defaulted to General');
    }

    let dateSolved = rawDate ? tryParseDate(rawDate) : null;
    if (!rawDate) {
      defaulted.push('dateSolved');
      warn('Missing date, defaulted to today');
    } else if (!dateSolved) {
      defaulted.push('dateSolved');
      warn('Unrecognized date, defaulted to today');
    }
    dateSolved ??= new Date(today);

    let url = normalizeUrl(rawUrl);
    const urlMissing = !rawUrl || url === '#';
    if (urlMissing) {
      defaulted.push('url');
      warn("Missing URL, placeholder '#' used");
    }

    let problemNumber: number | null = /^\d+$/.test(rawNumber) ? parseInt(rawNumber, 10) : null;
    if (!problemNumber && rawUrl) problemNumber = await extractProblemNumberFromUrl(rawUrl, platform);
    if (!problemNumber || problemNumber <= 0) {
      problemNumber = 100000 + i; // safe high range
      warn(`Problem number generated (${problemNumber})`);
    }

    // Fill gaps from the platform dataset.
    try {
      const res = await getResolver(platform)?.resolve(String(problemNumber));
      if (res?.found) {
        if (!rawDiff && res.data.difficulty) difficulty = res.data.difficulty;
        if (!rawTopic && res.data.topic) topic = res.data.topic;
        if (urlMissing && res.data.url) url = res.data.url;
      }
    } catch {
      /* enrichment is best-effort */
    }

    const key = `${platform}:${problemNumber}`;
    if (seenKeys.has(key)) {
      skipped.push({ row: rowNum, reason: `Row ${rowNum}: Duplicate problem (${platform} #${problemNumber}) in file` });
      continue;
    }
    seenKeys.add(key);

    // Schedule found in the file (our own CSV export), used by "preserve".
    const rawStatus = get('status');
    const rawStep = get('currentStep');
    const rawNext = get('nextRevisionAt');
    const rawCount = get('revisionCount');
    let original: ProcessedProblem['original'];
    if (rawStatus || rawStep || rawNext) {
      const status = parseStatus(rawStatus) ?? 'ACTIVE';
      const next =
        tryParseDate(rawNext) ?? scheduleFor('fresh', dateSolved, { index: 0, today, batchSize, ladder }).nextRevisionAt;
      original = {
        status,
        currentStep: clampStep(rawStep) ?? (status === 'ACTIVE' ? 0 : 3),
        nextRevisionAt: next.toISOString(),
        revisionCount: /^\d+$/.test(rawCount) ? parseInt(rawCount, 10) : undefined,
      };
    }

    const schedule = scheduleFor(strategy, dateSolved, { index: valid.length, today, batchSize, ladder }, original);

    const customFields: Record<string, string> = {};
    for (const { header, column } of customMappings) {
      const value = row[header];
      if (value !== undefined && value !== null && String(value).trim()) customFields[column] = String(value).trim();
    }

    const extras: Partial<ProcessedProblem> = {};
    const rawCode = get('code');
    if (rawCode) extras.code = rawCode.slice(0, 40);
    if (headerFor.tags) extras.tags = parseList(get('tags'), true);
    if (headerFor.lists) extras.lists = parseList(get('lists'));
    if (headerFor.isFavorite) extras.isFavorite = parseBoolean(get('isFavorite'));
    if (original) extras.original = original;
    extras.revisionCount =
      strategy === 'preserve' && original?.revisionCount !== undefined ? original.revisionCount : 0;

    valid.push({
      platform,
      problemNumber,
      title,
      url,
      difficulty,
      topic,
      dateSolved: dateSolved.toISOString(),
      notes: rawNotes || null,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      currentStep: schedule.currentStep,
      nextRevisionAt: schedule.nextRevisionAt.toISOString(),
      status: schedule.status,
      ...extras,
      ...(defaulted.length ? { defaulted } : {}),
    });
  }

  return { valid, warnings, errors, skipped, customColumns };
}

// ─── JSON backup (GET /api/export) parsing: v2 and the older v1 shape ───────

export type BackupParseResult =
  | { ok: true; version: 1 | 2; exportedAt: string | null; result: ValidationResult }
  | { ok: false; error: string };

const CONFIDENCES = ['CLEAN', 'SHAKY', 'STRUGGLED'];

function parseRevision(r: any): ImportedRevision | null {
  if (!r || typeof r !== 'object') return null;
  const at = new Date(r.revisedAt);
  if (Number.isNaN(at.getTime()) || !CONFIDENCES.includes(r.confidence)) return null;
  const stepBefore = clampStep(r.stepBefore) ?? 0;
  return {
    revisedAt: at.toISOString(),
    confidence: r.confidence,
    type: r.type === 'RECHECK' ? 'RECHECK' : 'REGULAR',
    stepBefore,
    stepAfter: clampStep(r.stepAfter) ?? stepBefore,
  };
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Parses a JSON backup.
 * v1 (old export): { exportedAt, user, totalProblems, problems: Problem[] with revisions, streakLogs }
 * v2: { version: 2, exportedAt, preferences, columns, lists, problems (lists as names, revisions nested), streakLogs, studyItems? }
 * Unknown keys (e.g. preferences dropped in later versions) are ignored.
 */
export function parseBackup(text: string, today: Date = new Date()): BackupParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.problems)) {
    return { ok: false, error: `This JSON file is not a ${siteConfig.name} backup (no "problems" list found).` };
  }
  const version = data.version === undefined ? 1 : Number(data.version);
  if (version !== 1 && version !== 2) {
    return { ok: false, error: `Unsupported backup version ${String(data.version)}. Update ${siteConfig.name} and try again.` };
  }
  if (data.problems.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `This backup has ${data.problems.length} problems. The limit per import is ${MAX_IMPORT_ROWS}.` };
  }

  const valid: ProcessedProblem[] = [];
  const warnings: ValidationResult['warnings'] = [];
  const errors: ValidationResult['errors'] = [];
  const skipped: ValidationResult['skipped'] = [];
  const seen = new Set<string>();

  data.problems.forEach((p: any, i: number) => {
    const row = i + 1;
    const skip = (reason: string) => {
      errors.push({ row, message: `Problem ${row}: ${reason}` });
      skipped.push({ row, reason });
    };

    if (!p || typeof p !== 'object') return skip('Not an object');
    const title = typeof p.title === 'string' ? p.title.trim() : '';
    if (!title) return skip('Missing title');
    if (!VALID_PLATFORMS.includes(p.platform)) return skip(`Unknown platform "${p.platform}"`);
    if (!Number.isInteger(p.problemNumber) || p.problemNumber <= 0) return skip('Invalid problem number');
    const key = `${p.platform}:${p.problemNumber}`;
    if (seen.has(key)) return skip(`Duplicate problem (${p.platform} #${p.problemNumber}) in file`);
    seen.add(key);

    const parsedSolved = new Date(p.dateSolved);
    const solvedValid = !Number.isNaN(parsedSolved.getTime());
    const solved = solvedValid ? parsedSolved : new Date(today);
    if (!solvedValid) warnings.push({ row, message: `Problem ${row}: Invalid solve date, defaulted to today` });

    const revisions: ImportedRevision[] = (Array.isArray(p.revisions) ? p.revisions : [])
      .slice(0, MAX_REVISIONS_PER_PROBLEM)
      .map(parseRevision)
      .filter((r: ImportedRevision | null): r is ImportedRevision => r !== null);
    const revisionCount = Number.isInteger(p.revisionCount) && p.revisionCount >= 0 ? p.revisionCount : revisions.length;

    const next = new Date(p.nextRevisionAt);
    const original = {
      status: parseStatus(p.status) ?? 'ACTIVE',
      currentStep: clampStep(p.currentStep) ?? 0,
      nextRevisionAt: (Number.isNaN(next.getTime())
        ? scheduleFor('fresh', solved, { index: 0, today, batchSize: 1 }).nextRevisionAt
        : next
      ).toISOString(),
      revisionCount,
    };
    const customFields = readCustomFields(p.customFields);

    valid.push({
      platform: p.platform,
      problemNumber: p.problemNumber,
      title: title.slice(0, 300),
      url: nonEmpty(p.url) ? p.url.trim() : '#',
      difficulty: (VALID_DIFFICULTIES as readonly string[]).includes(p.difficulty) ? p.difficulty : 'MEDIUM',
      topic: nonEmpty(p.topic) ? p.topic.trim() : 'General',
      dateSolved: solved.toISOString(),
      notes: nonEmpty(p.notes) ? p.notes : null,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      code: nonEmpty(p.code) ? p.code.trim() : null,
      tags: toStringList(p.tags),
      lists: toStringList(p.lists, 100),
      isFavorite: p.isFavorite === true,
      revisions,
      revisionCount,
      original,
      status: original.status,
      currentStep: original.currentStep,
      nextRevisionAt: original.nextRevisionAt,
    });
  });

  // Column definitions: v2 has typed columns; v1 only has customFields keys.
  const columnDefs: ImportColumnDef[] = [];
  const seenColumns = new Set<string>();
  const addColumn = (name: string, type: ColumnType = 'text', options: string[] = []) => {
    const n = name.trim();
    const k = n.toLowerCase();
    if (!n || n.length > 40 || seenColumns.has(k)) return;
    seenColumns.add(k);
    columnDefs.push({ name: n, type, options });
  };
  if (Array.isArray(data.columns)) {
    data.columns
      .filter((c: any) => c && typeof c.name === 'string')
      .sort((a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .forEach((c: any) => {
        const options = normalizeOptions(c.options);
        addColumn(c.name, isColumnType(c.type) ? c.type : 'text', options.ok ? options.value : []);
      });
  }
  for (const p of valid) for (const name of Object.keys(p.customFields ?? {})) addColumn(name);

  const streakLogs = (Array.isArray(data.streakLogs) ? data.streakLogs : [])
    .map((s: any) => ({ date: typeof s?.date === 'string' ? s.date.slice(0, 10) : '', completed: s?.completed === true }))
    .filter((s: { date: string }) => /^\d{4}-\d{2}-\d{2}$/.test(s.date))
    .slice(0, 5000);

  const studyItems = (Array.isArray(data.studyItems) ? data.studyItems : [])
    .filter((s: unknown) => s && typeof s === 'object' && !Array.isArray(s))
    .slice(0, 500);

  return {
    ok: true,
    version: version as 1 | 2,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    result: {
      valid,
      warnings,
      errors,
      skipped,
      customColumns: columnDefs.map((c) => c.name),
      columnDefs,
      streakLogs,
      studyItems,
    },
  };
}

// ─── Duplicate handling (server side): overwrite / merge into an existing problem ──

export type ExistingProblem = {
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  dateSolved: Date;
  notes: string | null;
  code: string | null;
  tags: string[];
  customFields: unknown;
  isFavorite: boolean;
  status: string;
  currentStep: number;
  nextRevisionAt: Date;
  revisionCount: number;
};

export type ProblemUpdate = {
  title?: string;
  url?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  topic?: string;
  dateSolved?: Date;
  notes?: string | null;
  code?: string | null;
  tags?: string[];
  customFields?: Record<string, string>;
  isFavorite?: boolean;
  status?: ProblemStatusValue;
  currentStep?: number;
  nextRevisionAt?: Date;
  revisionCount?: number;
};

/** Higher = further along: ACTIVE steps 0-3, then MASTERED/RETIRED. */
export function scheduleRank(status: string, step: number): number {
  return status === 'ACTIVE' ? step : 4;
}

/**
 * overwrite: imported values replace existing ones (fields the file didn't provide are kept).
 * merge:     fill only empty fields, union tags, keep the more advanced schedule.
 */
export function buildDuplicateUpdate(
  existing: ExistingProblem,
  incoming: ProcessedProblem & { defaulted?: string[] },
  mode: 'overwrite' | 'merge'
): ProblemUpdate {
  const given = (field: string) => !incoming.defaulted?.includes(field);
  const existingFields = readCustomFields(existing.customFields);
  const incomingFields = incoming.customFields ?? {};
  const update: ProblemUpdate = {};

  if (mode === 'overwrite') {
    update.title = incoming.title;
    if (given('url')) update.url = incoming.url;
    if (given('difficulty')) update.difficulty = incoming.difficulty;
    if (given('topic')) update.topic = incoming.topic;
    if (given('dateSolved')) update.dateSolved = new Date(incoming.dateSolved);
    if (incoming.notes) update.notes = incoming.notes;
    if (incoming.code) update.code = incoming.code;
    if (incoming.tags !== undefined) update.tags = incoming.tags;
    if (incoming.isFavorite !== undefined) update.isFavorite = incoming.isFavorite;
    update.customFields = { ...existingFields, ...incomingFields };
    update.status = incoming.status;
    update.currentStep = incoming.currentStep;
    update.nextRevisionAt = new Date(incoming.nextRevisionAt);
    if (incoming.revisionCount !== undefined) update.revisionCount = incoming.revisionCount;
    return update;
  }

  // merge
  if ((!existing.url || existing.url === '#') && given('url') && incoming.url !== '#') update.url = incoming.url;
  if ((!existing.topic || existing.topic === 'General') && given('topic')) update.topic = incoming.topic;
  if (!existing.notes?.trim() && incoming.notes) update.notes = incoming.notes;
  if (!existing.code?.trim() && incoming.code) update.code = incoming.code;
  if (given('dateSolved')) {
    const solved = new Date(incoming.dateSolved);
    if (solved < existing.dateSolved) update.dateSolved = solved; // keep the earliest solve
  }
  if (incoming.tags?.length) {
    const existingTags = existing.tags ?? [];
    const union = parseList([...existingTags, ...incoming.tags].join(';'), false, MAX_TAGS);
    if (union.length !== existingTags.length) update.tags = union;
  }
  if (incoming.isFavorite && !existing.isFavorite) update.isFavorite = true;

  const merged = { ...existingFields };
  let fieldsChanged = false;
  for (const [key, value] of Object.entries(incomingFields)) {
    if (!merged[key]?.trim() && value) {
      merged[key] = value;
      fieldsChanged = true;
    }
  }
  if (fieldsChanged) update.customFields = merged;

  if (scheduleRank(incoming.status, incoming.currentStep) > scheduleRank(existing.status, existing.currentStep)) {
    update.status = incoming.status;
    update.currentStep = incoming.currentStep;
    update.nextRevisionAt = new Date(incoming.nextRevisionAt);
  }
  const count = incoming.revisionCount ?? 0;
  if (count > existing.revisionCount) update.revisionCount = count;
  return update;
}
