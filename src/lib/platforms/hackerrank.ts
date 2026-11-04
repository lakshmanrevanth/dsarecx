import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { djb2, isUrlLike, lazy, metaFromRow, titleFromSlug, type DatasetRow } from './dataset';

const loadDataset = lazy(async () => {
  const rows = (await import('../../data/hackerrank-problems.json')).default as unknown as DatasetRow[];
  const bySlug = new Map<string, ProblemMeta>();
  const byCode = new Map<string, ProblemMeta>();
  for (const row of rows) {
    const meta = metaFromRow(row);
    if (row.slug) bySlug.set(row.slug.toLowerCase(), meta);
    if (row.code) byCode.set(row.code.toUpperCase(), meta);
  }
  return { bySlug, byCode };
});

/** HackerRank: seed dataset, plus a challenge-URL fallback that titles the slug. */
class HackerRankResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const raw = identifier.trim();
    if (!raw) return { found: false };

    const { bySlug, byCode } = await loadDataset();

    if (raw.includes('hackerrank.com') || isUrlLike(raw)) {
      const m = raw.match(/hackerrank\.com\/(?:contests\/[^/]+\/)?challenges\/([^/]+)/i);
      const slug = (m ? m[1] : raw.split('/').filter((s) => s !== 'problem').pop())?.toLowerCase();
      if (slug) {
        const known = bySlug.get(slug);
        if (known) return { found: true, data: known };
        return {
          found: true,
          data: {
            title: titleFromSlug(slug) || 'HackerRank Challenge',
            difficulty: 'EASY',
            topic: 'General',
            url: raw.startsWith('http') ? raw : `https://${raw}`,
            problemNumber: djb2(slug),
            code: slug.toUpperCase(),
          },
        };
      }
    }

    const hit = byCode.get(raw.toUpperCase()) ?? bySlug.get(raw.toLowerCase());
    return hit ? { found: true, data: hit } : { found: false };
  }
}

export const hackerrankResolver = new HackerRankResolver();
