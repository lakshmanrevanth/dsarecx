import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { isUrlLike, lazy, metaFromRow, type DatasetRow } from './dataset';

const loadDataset = lazy(async () => {
  const rows = (await import('../../data/codechef-problems.json')).default as unknown as DatasetRow[];
  const byCode = new Map<string, ProblemMeta>();
  const byNumber = new Map<number, ProblemMeta>();
  const byTitle = new Map<string, ProblemMeta>();
  for (const row of rows) {
    const meta = metaFromRow(row);
    if (row.code) byCode.set(row.code.toUpperCase(), meta);
    if (row.numericId) byNumber.set(row.numericId, meta);
    if (row.title) byTitle.set(row.title.toLowerCase().trim(), meta);
  }
  return { byCode, byNumber, byTitle };
});

/** Looks a CodeChef problem up by URL, code ("FLOW001"), numeric id, or exact title. */
class CodeChefResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const raw = identifier.trim();
    if (!raw) return { found: false };

    const { byCode, byNumber, byTitle } = await loadDataset();

    if (raw.includes('codechef.com') || isUrlLike(raw)) {
      const m = raw.match(/codechef\.com\/(?:[^/]+\/)?problems\/([A-Za-z0-9]+)/i);
      const fromUrl = m ? byCode.get(m[1].toUpperCase()) : undefined;
      if (fromUrl) return { found: true, data: fromUrl };
    }

    const codeHit = byCode.get(raw.toUpperCase());
    if (codeHit) return { found: true, data: codeHit };

    const num = parseInt(raw, 10);
    if (!Number.isNaN(num)) {
      const numberHit = byNumber.get(num);
      if (numberHit) return { found: true, data: numberHit };
    }

    const titleHit = byTitle.get(raw.toLowerCase());
    if (titleHit) return { found: true, data: titleHit };

    return { found: false };
  }
}

export const codechefResolver = new CodeChefResolver();
