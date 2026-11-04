// Server-side caching of per-user lists via Next's data cache. Each user's
// entries share a tag so a write can invalidate exactly that user's data.

import { unstable_cache, revalidateTag } from 'next/cache';
import type { ProblemStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const ONE_HOUR = 3600;
const problemsTag = (userId: string) => `user-problems-${userId}`;
const columnsTag = (userId: string) => `user-columns-${userId}`;

/** A user's problems (newest first) with their latest revision, optionally filtered. */
export async function getCachedUserProblems(userId: string, status?: string, topic?: string) {
  const key = `user-problems-${userId}-${status || 'all'}-${topic || 'all'}`;
  return unstable_cache(
    () =>
      prisma.problem.findMany({
        where: {
          userId,
          ...(status ? { status: status as ProblemStatus } : {}),
          ...(topic ? { topic } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: { revisions: { orderBy: { revisedAt: 'desc' }, take: 1 } },
      }),
    [key],
    { tags: [problemsTag(userId)], revalidate: ONE_HOUR }
  )();
}

/** A user's custom column definitions in display order. */
export async function getCachedUserColumns(userId: string) {
  return unstable_cache(
    () => prisma.userColumnConfig.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
    [`user-columns-${userId}`],
    { tags: [columnsTag(userId)], revalidate: ONE_HOUR }
  )();
}

function safeRevalidate(tag: string) {
  try {
    revalidateTag(tag, 'max');
  } catch (e) {
    // Outside a request scope (e.g. tests, scripts) revalidation can throw; it is best-effort.
    console.warn(`[cache] revalidateTag ${tag} failed:`, e);
  }
}

export function invalidateUserProblems(userId: string) {
  safeRevalidate(problemsTag(userId));
}

export function invalidateUserColumns(userId: string) {
  safeRevalidate(columnsTag(userId));
}
