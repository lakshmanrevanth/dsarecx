// Internal helpers shared by the dataset-backed resolvers.

import type { ProblemMeta } from './types';

/** A raw row from one of the bundled src/data/*.json files. */
export type DatasetRow = {
  id?: number | string;
  numericId?: number;
  code?: string;
  slug?: string;
  title: string;
  difficulty: ProblemMeta['difficulty'];
  topic: string;
  url: string;
};

/** Memoises an async loader so a dataset is indexed once per process. */
export function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = load().catch((err) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}

/** djb2 string hash, always non-negative. */
export function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function isUrlLike(raw: string): boolean {
  return raw.startsWith('http://') || raw.startsWith('https://');
}

/** "some-slug-here" → "Some Slug Here". */
export function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Builds a ProblemMeta from a dataset row that carries numericId/code. */
export function metaFromRow(row: DatasetRow): ProblemMeta {
  return {
    title: row.title,
    difficulty: row.difficulty,
    topic: row.topic,
    url: row.url,
    problemNumber: row.numericId,
    code: row.code,
  };
}
