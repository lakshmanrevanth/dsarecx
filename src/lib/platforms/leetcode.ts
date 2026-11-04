import type { PlatformResolver, ResolveResult, ProblemMeta } from './types';
import { lazy, type DatasetRow } from './dataset';

const loadById = lazy(async () => {
  const rows = (await import('../../data/leetcode-problems.json')).default as unknown as DatasetRow[];
  const byId = new Map<number, ProblemMeta>();
  for (const row of rows) {
    const id = Number(row.id);
    byId.set(id, {
      problemNumber: id,
      title: row.title,
      difficulty: row.difficulty,
      topic: row.topic,
      url: row.url,
    });
  }
  return byId;
});

/** Offline lookup by LeetCode problem number (the live GraphQL fallback is /api/leetcode/lookup). */
class LeetCodeResolver implements PlatformResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    const id = parseInt(identifier, 10);
    if (Number.isNaN(id)) return { found: false };
    const data = (await loadById()).get(id);
    return data ? { found: true, data } : { found: false };
  }
}

export const leetcodeResolver = new LeetCodeResolver();
