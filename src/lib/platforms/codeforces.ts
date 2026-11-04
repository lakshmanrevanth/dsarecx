import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { lazy, type DatasetRow } from './dataset';
import { codeforcesNumericId } from './problem-input';

// ── Bundled dataset ─────────────────────────────────────────────────────────

const loadDataset = lazy(async () => {
  const rows = (await import('../../data/codeforces-problems.json')).default as unknown as DatasetRow[];
  const byCode = new Map<string, ProblemMeta>();
  const byNumber = new Map<number, ProblemMeta>();
  for (const row of rows) {
    const code = String(row.id);
    const meta: ProblemMeta = {
      title: row.title,
      difficulty: row.difficulty,
      topic: row.topic,
      url: row.url,
      problemNumber: codeforcesNumericId(code) ?? row.numericId,
      code,
    };
    byCode.set(code.toUpperCase(), meta);
    if (row.numericId) byNumber.set(row.numericId, meta);
  }
  return { byCode, byNumber };
});

// ── Live fallback: the public Codeforces API, cached in memory for an hour ──

const CF_API = 'https://codeforces.com/api/problemset.problems';
const LIVE_TTL_MS = 60 * 60 * 1000;
const LIVE_TIMEOUT_MS = 6000;

let liveCache: { at: number; map: Map<string, ProblemMeta> } | null = null;
let liveInflight: Promise<Map<string, ProblemMeta>> | null = null;

/** Codeforces rating → our three-level difficulty. Unrated problems are MEDIUM. */
export function ratingToDifficulty(rating: unknown): ProblemMeta['difficulty'] {
  if (typeof rating !== 'number') return 'MEDIUM';
  if (rating < 1200) return 'EASY';
  if (rating < 1800) return 'MEDIUM';
  return 'HARD';
}

type LiveProblem = { contestId?: unknown; index?: unknown; name?: unknown; rating?: unknown; tags?: unknown };

/** Builds a code → meta map from the API's `result.problems`, skipping malformed rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLiveMap(problems: any[]): Map<string, ProblemMeta> {
  const map = new Map<string, ProblemMeta>();
  for (const p of problems as LiveProblem[]) {
    if (!p || typeof p.contestId !== 'number' || typeof p.index !== 'string' || !p.name) continue;
    const code = `${p.contestId}${p.index}`.toUpperCase();
    const firstTag = Array.isArray(p.tags) && p.tags[0] ? String(p.tags[0]) : '';
    map.set(code, {
      title: String(p.name),
      difficulty: ratingToDifficulty(p.rating),
      topic: firstTag,
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      problemNumber: codeforcesNumericId(code) ?? undefined,
      code,
    });
  }
  return map;
}

async function fetchLiveMap(): Promise<Map<string, ProblemMeta>> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL_MS) return liveCache.map;
  // Concurrent misses share one request.
  if (!liveInflight) {
    liveInflight = (async () => {
      const res = await fetch(CF_API, { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Codeforces API ${res.status}`);
      const json = await res.json();
      if (json?.status !== 'OK' || !Array.isArray(json?.result?.problems)) {
        throw new Error('Codeforces API returned an unexpected response');
      }
      const map = buildLiveMap(json.result.problems);
      liveCache = { at: Date.now(), map };
      return map;
    })().finally(() => {
      liveInflight = null;
    });
  }
  return liveInflight;
}

/** Test hook: forget the live cache. */
export function _resetCodeforcesLiveCache() {
  liveCache = null;
  liveInflight = null;
}

/** Accepts "4A", "4a", "1234C2", or a problemset / contest / gym URL; returns an upper-case code. */
export function parseCodeforcesIdentifier(identifier: string): string {
  const raw = identifier.trim();
  const m = raw.match(/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/);
  return (m ? `${m[1]}${m[2]}` : raw).toUpperCase();
}

class CodeforcesResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const code = parseCodeforcesIdentifier(identifier);
    if (!code) return { found: false };

    const { byCode, byNumber } = await loadDataset();

    const direct = byCode.get(code);
    if (direct) return { found: true, data: direct };

    if (/^\d+$/.test(code)) {
      const numbered = byNumber.get(parseInt(code, 10));
      if (numbered) return { found: true, data: numbered };
    }

    // Problems newer than the bundled dataset: ask the live API.
    if (/^\d+[A-Z]\d*$/.test(code)) {
      try {
        const hit = (await fetchLiveMap()).get(code);
        return hit ? { found: true, data: hit } : { found: false, reason: 'not_found' };
      } catch (err) {
        console.warn('[codeforces] live lookup failed', err);
        return { found: false, reason: 'lookup_failed' };
      }
    }

    return { found: false, reason: 'not_found' };
  }
}

export const codeforcesResolver = new CodeforcesResolver();
