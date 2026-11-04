import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { djb2, isUrlLike, lazy, metaFromRow, titleFromSlug, type DatasetRow } from './dataset';

const loadDataset = lazy(async () => {
  const rows = (await import('../../data/gfg-problems.json')).default as unknown as DatasetRow[];
  const bySlug = new Map<string, ProblemMeta>();
  const byCode = new Map<string, ProblemMeta>();
  for (const row of rows) {
    const meta = metaFromRow(row);
    if (row.slug) bySlug.set(row.slug.toLowerCase(), meta);
    if (row.code) byCode.set(row.code.toUpperCase(), meta);
  }
  return { bySlug, byCode };
});

/**
 * GeeksforGeeks: a small seed dataset, plus a URL fallback that derives the
 * title from the slug ("binary-search-1587115620" → "Binary Search").
 */
class GFGResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const raw = identifier.trim();
    if (!raw) return { found: false };

    const { bySlug, byCode } = await loadDataset();

    if (raw.includes('geeksforgeeks.org') || raw.includes('gfg') || isUrlLike(raw)) {
      const m = raw.match(/geeksforgeeks\.org\/problems\/([^/]+)/i);
      const slug = (m ? m[1] : raw.split('/').filter(Boolean).pop())?.toLowerCase();
      if (slug) {
        const known = bySlug.get(slug);
        if (known) return { found: true, data: known };

        const title = titleFromSlug(
          slug
            .replace(/-\d+$/, '') // trailing id like -1587115621
            .replace(/\d+$/, ''), // trailing digits like 1416
        );
        return {
          found: true,
          data: {
            title: title || 'GFG Problem',
            difficulty: 'MEDIUM',
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

export const gfgResolver = new GFGResolver();
