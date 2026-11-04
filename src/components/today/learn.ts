// "Learned it" for a to-learn item, and quick-add parsing. A learned DSA item goes
// through POST /api/problems (same lookup + schedule as the dashboard's add row);
// a system design item goes through POST /api/concepts. The caller deletes the
// StudyItem once this reports learned or already tracked.

import { lookupProblem, manualPrefill } from '@/components/problems-table/lookup';
import { CONCEPTS, CONCEPT_CATEGORIES } from '@/lib/concepts/library';
import {
  CODING_PLATFORMS,
  classifyDsaInput,
  fallbackDsaTitle,
  platformFromUrl,
  type CodingPlatform,
  type StudyDifficulty,
  type StudyItemDto,
} from '@/lib/study';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** What the inline form asks for when a DSA problem can't be looked up. */
export type DsaDetails = { title: string; url: string; difficulty: StudyDifficulty | ''; topic: string };

export type LearnOutcome =
  | { status: 'learned'; id: string | null }
  | { status: 'already'; message: string }
  | { status: 'needs-details'; prefill: DsaDetails; message?: string }
  | { status: 'needs-category'; prefill: string }
  | { status: 'error'; message: string };

const isCategory = (v: string | null | undefined): v is string => !!v && (CONCEPT_CATEGORIES as readonly string[]).includes(v);

/** The built-in library concept with exactly this title, if any. */
export function libraryConceptFor(title: string) {
  const t = title.trim().toLowerCase();
  return CONCEPTS.find((c) => c.title.toLowerCase() === t);
}

export function itemPlatform(item: Pick<StudyItemDto, 'platform' | 'url' | 'identifier'>): CodingPlatform {
  return item.platform ?? platformFromUrl(item.url ?? '') ?? platformFromUrl(item.identifier ?? '') ?? 'LEETCODE';
}

async function post(fetchImpl: FetchLike, url: string, body: Record<string, unknown>) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // non-JSON error page
  }
  return { res, json };
}

const message = (json: Record<string, unknown>, fallback: string) => (typeof json.error === 'string' && json.error) || fallback;

/** Marks a DSA item learned. Without `details`, tries the lookup first and asks for details if that fails. */
export async function learnDsa(item: StudyItemDto, details?: DsaDetails, fetchImpl: FetchLike = fetch): Promise<LearnOutcome> {
  const platform = itemPlatform(item);
  const query = (item.identifier || item.url || '').trim();
  const prefill: DsaDetails = {
    title: item.title,
    url: item.url ?? manualPrefill(platform, query).url,
    difficulty: item.difficulty ?? '',
    topic: item.topic ?? '',
  };
  const notes = item.note ?? undefined;

  let body: Record<string, unknown> | null = null;
  if (details) {
    body = { platform, ...manualPrefill(platform, query), ...details, notes };
  } else if (query) {
    const found = await lookupProblem(platform, query, fetchImpl);
    if (found.status === 'found') {
      const d = found.data;
      body = {
        platform,
        problemNumber: d.problemNumber,
        code: d.code,
        title: d.title || item.title,
        url: d.url,
        difficulty: d.difficulty || item.difficulty || '',
        topic: d.topic || item.topic || '',
        notes,
      };
    }
  }
  // Not found, but the item already has everything a manual entry needs.
  if (!body && prefill.url && prefill.difficulty) body = { platform, ...manualPrefill(platform, query), ...prefill, notes };
  if (!body) return { status: 'needs-details', prefill };

  const { res, json } = await post(fetchImpl, '/api/problems', body);
  if (res.status === 201) return { status: 'learned', id: typeof json.id === 'string' ? json.id : null };
  if (res.status === 409) return { status: 'already', message: 'Already in your problems' };
  if (res.status === 400 || res.status === 422) {
    return { status: 'needs-details', prefill: details ?? prefill, message: message(json, 'Add the missing details') };
  }
  return { status: 'error', message: message(json, 'Could not save the problem') };
}

/** Marks a system design item learned, as a library concept when the title matches one. */
export async function learnConcept(item: StudyItemDto, category?: string, fetchImpl: FetchLike = fetch): Promise<LearnOutcome> {
  const library = category ? undefined : libraryConceptFor(item.title);
  const base = { url: item.url ?? undefined, notes: item.note ?? undefined };
  let body: Record<string, unknown>;
  if (library) body = { slug: library.slug, ...base };
  else {
    const cat = category ?? (isCategory(item.topic) ? item.topic : null);
    if (!cat) return { status: 'needs-category', prefill: '' };
    body = { title: item.title, category: cat, ...base };
  }

  const { res, json } = await post(fetchImpl, '/api/concepts', body);
  if (res.status === 201) return { status: 'learned', id: typeof json.id === 'string' ? json.id : null };
  if (res.status === 409) return { status: 'already', message: 'Already in your concepts' };
  return { status: 'error', message: message(json, 'Could not save the concept') };
}

/** The body for POST /api/study from a quick-add line. DSA ids and links are looked up for a real title. */
export async function buildQuickAdd(
  kind: 'DSA' | 'SYSTEM_DESIGN',
  text: string,
  opts: { platform: CodingPlatform; targetDate: string | null },
  fetchImpl: FetchLike = fetch
): Promise<Record<string, unknown>> {
  const value = text.trim();
  const targetDate = opts.targetDate || null;

  if (kind === 'SYSTEM_DESIGN') {
    const library = libraryConceptFor(value);
    return { kind, title: library?.title ?? value, topic: library?.category ?? null, targetDate };
  }

  const input = classifyDsaInput(value);
  if (input.type === 'title') return { kind, title: value, platform: opts.platform, targetDate };

  const detected = input.type === 'url' ? platformFromUrl(value) : null;
  const platform = detected ?? opts.platform;
  const base = { kind, platform, identifier: value, url: input.type === 'url' ? value : null, targetDate };
  // A link to some other site: keep it as a link, nothing to look up.
  if (input.type === 'url' && !detected) return { ...base, title: fallbackDsaTitle(platform, input), platform: null };

  const found = await lookupProblem(platform, value, fetchImpl).catch(() => null);
  if (found?.status === 'found') {
    const d = found.data;
    return {
      ...base,
      title: d.title || fallbackDsaTitle(platform, input),
      url: d.url || base.url,
      difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(d.difficulty) ? d.difficulty : null,
      topic: d.topic || null,
    };
  }
  return { ...base, title: fallbackDsaTitle(platform, input) };
}

export const isCodingPlatform = (v: unknown): v is CodingPlatform => (CODING_PLATFORMS as unknown[]).includes(v);
