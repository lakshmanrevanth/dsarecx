// The to-learn backlog (StudyItem): validation and serialization shared by
// /api/study, /api/today, the JSON backup, and the Today page. No server-only
// imports, so the client can use the same rules.

export type StudyKind = 'DSA' | 'SYSTEM_DESIGN';
export const STUDY_KINDS: StudyKind[] = ['DSA', 'SYSTEM_DESIGN'];

export type CodingPlatform = 'LEETCODE' | 'CODEFORCES' | 'GFG' | 'HACKERRANK' | 'CODECHEF';
export const CODING_PLATFORMS: CodingPlatform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];
export const PLATFORM_LABELS: Record<CodingPlatform, string> = {
  LEETCODE: 'LeetCode',
  CODEFORCES: 'Codeforces',
  GFG: 'GeeksforGeeks',
  HACKERRANK: 'HackerRank',
  CODECHEF: 'CodeChef',
};

export type StudyDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
const DIFFICULTIES: StudyDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export const MAX_STUDY_ITEMS = 500;
export const STUDY_LIMITS = { title: 200, url: 2000, identifier: 200, topic: 100, note: 2000 } as const;

/** A to-learn item as the API returns it. */
export type StudyItemDto = {
  id: string;
  kind: StudyKind;
  title: string;
  url: string | null;
  platform: CodingPlatform | null;
  identifier: string | null;
  difficulty: StudyDifficulty | null;
  topic: string | null;
  note: string | null;
  /** "YYYY-MM-DD" or null. */
  targetDate: string | null;
  order: number;
  createdAt: string;
};

/** A to-learn item with its target date compared to the user's today. */
export type StudyItemWithFlags = StudyItemDto & { overdue: boolean; dueToday: boolean };

/** Fields a create or update may set (already validated). */
export type StudyFields = {
  kind?: StudyKind;
  title?: string;
  url?: string | null;
  platform?: CodingPlatform | null;
  identifier?: string | null;
  difficulty?: StudyDifficulty | null;
  topic?: string | null;
  note?: string | null;
  /** "YYYY-MM-DD" or null. */
  targetDate?: string | null;
};

type StudyRow = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  platform: string | null;
  identifier: string | null;
  difficulty: string | null;
  topic: string | null;
  note: string | null;
  targetDate: Date | null;
  order: number;
  createdAt: Date;
};

const isCodingPlatform = (v: unknown): v is CodingPlatform => (CODING_PLATFORMS as unknown[]).includes(v);

/** A real calendar day in "YYYY-MM-DD" form. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  const y = d.getUTCFullYear();
  return !isNaN(d.getTime()) && y >= 1900 && y <= 9999 && d.toISOString().slice(0, 10) === value;
}

/** Value for the @db.Date column. */
export const dayKeyToDate = (key: string) => new Date(`${key}T00:00:00.000Z`);

export function toStudyDto(row: StudyRow): StudyItemDto {
  return {
    id: row.id,
    kind: row.kind === 'SYSTEM_DESIGN' ? 'SYSTEM_DESIGN' : 'DSA',
    title: row.title,
    url: row.url,
    platform: isCodingPlatform(row.platform) ? row.platform : null,
    identifier: row.identifier,
    difficulty: (DIFFICULTIES as string[]).includes(row.difficulty ?? '') ? (row.difficulty as StudyDifficulty) : null,
    topic: row.topic,
    note: row.note,
    targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
    order: row.order,
    createdAt: row.createdAt.toISOString(),
  };
}

export function withTargetFlags(item: StudyItemDto, todayKey: string): StudyItemWithFlags {
  return {
    ...item,
    overdue: item.targetDate !== null && item.targetDate < todayKey,
    dueToday: item.targetDate === todayKey,
  };
}

/** Optional text: undefined when absent, null when cleared, or the trimmed value. */
function optionalText(body: Record<string, unknown>, key: string, max: number, label: string): string | null | undefined | { error: string } {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return { error: `${label} must be text` };
  const text = v.trim();
  if (text.length > max) return { error: `${label} must be at most ${max} characters` };
  return text || null;
}

const isError = (v: unknown): v is { error: string } => typeof v === 'object' && v !== null && 'error' in v;

/**
 * Validates a create (`partial = false`: kind and title required) or an update
 * (only the fields sent). Returns the clean fields or the first error.
 */
export function parseStudyInput(body: Record<string, unknown>, partial: boolean): { data: StudyFields } | { error: string } {
  const data: StudyFields = {};

  if ('kind' in body || !partial) {
    if (!(STUDY_KINDS as unknown[]).includes(body.kind)) return { error: 'kind must be DSA or SYSTEM_DESIGN' };
    data.kind = body.kind as StudyKind;
  }

  if ('title' in body || !partial) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return { error: 'Give it a title' };
    if (title.length > STUDY_LIMITS.title) return { error: `Title must be at most ${STUDY_LIMITS.title} characters` };
    data.title = title;
  }

  const url = optionalText(body, 'url', STUDY_LIMITS.url, 'Link');
  if (isError(url)) return url;
  if (url && !/^https?:\/\//i.test(url)) return { error: 'Link must start with http:// or https://' };
  if (url !== undefined) data.url = url;

  if ('platform' in body) {
    if (body.platform === null || body.platform === '') data.platform = null;
    else if (isCodingPlatform(body.platform)) data.platform = body.platform;
    else return { error: 'Unknown platform' };
  }

  const identifier = optionalText(body, 'identifier', STUDY_LIMITS.identifier, 'Problem number or link');
  if (isError(identifier)) return identifier;
  if (identifier !== undefined) data.identifier = identifier;

  if ('difficulty' in body) {
    if (body.difficulty === null || body.difficulty === '') data.difficulty = null;
    else {
      const d = String(body.difficulty).toUpperCase();
      if (!(DIFFICULTIES as string[]).includes(d)) return { error: 'Difficulty must be EASY, MEDIUM or HARD' };
      data.difficulty = d as StudyDifficulty;
    }
  }

  const topic = optionalText(body, 'topic', STUDY_LIMITS.topic, 'Topic');
  if (isError(topic)) return topic;
  if (topic !== undefined) data.topic = topic;

  const note = optionalText(body, 'note', STUDY_LIMITS.note, 'Note');
  if (isError(note)) return note;
  if (note !== undefined) data.note = note;

  if ('targetDate' in body) {
    if (body.targetDate === null || body.targetDate === '') data.targetDate = null;
    else if (isDayKey(body.targetDate)) data.targetDate = body.targetDate;
    else return { error: 'Target date must be a real day (YYYY-MM-DD)' };
  }

  return { data };
}

const PLATFORM_HOSTS: [RegExp, CodingPlatform][] = [
  [/(^|\.)leetcode\.(com|cn)$/i, 'LEETCODE'],
  [/(^|\.)codeforces\.com$/i, 'CODEFORCES'],
  [/(^|\.)geeksforgeeks\.org$/i, 'GFG'],
  [/(^|\.)hackerrank\.com$/i, 'HACKERRANK'],
  [/(^|\.)codechef\.com$/i, 'CODECHEF'],
];

/** The coding platform a problem URL belongs to, or null. */
export function platformFromUrl(text: string): CodingPlatform | null {
  let host: string;
  try {
    host = new URL(text.trim()).hostname;
  } catch {
    return null;
  }
  return PLATFORM_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

/**
 * What a DSA quick-add line means: a URL, a problem number/code (no spaces,
 * short), or a plain title.
 */
export function classifyDsaInput(text: string): { type: 'url' | 'id' | 'title'; value: string } {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) return { type: 'url', value };
  if (value && !/\s/.test(value) && value.length <= 40 && /\d/.test(value)) return { type: 'id', value };
  return { type: 'title', value };
}

/** A readable fallback title for a URL or problem id the lookup did not find. */
export function fallbackDsaTitle(platform: CodingPlatform, input: { type: 'url' | 'id' | 'title'; value: string }): string {
  if (input.type === 'title') return input.value;
  if (input.type === 'id') return `${PLATFORM_LABELS[platform]} ${input.value.toUpperCase()}`;
  try {
    const parts = new URL(input.value).pathname.split('/').filter(Boolean);
    const slug = [...parts].reverse().find((p) => /[a-z]/i.test(p) && !/^(problems?|problem-set|contest|challenges|problemset|practice)$/i.test(p));
    if (slug) return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, STUDY_LIMITS.title);
  } catch {
    // fall through
  }
  return `${PLATFORM_LABELS[platform]} problem`;
}
