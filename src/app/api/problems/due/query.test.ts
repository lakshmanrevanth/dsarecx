import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDueProblems } from './query';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: { problem: { findMany: vi.fn() } } }));

const DAY = 86_400_000;
const todayStart = new Date('2026-11-04T00:00:00Z');
const endOfToday = new Date(todayStart.getTime() + DAY - 1);

const row = (id: string, currentStep: number, dueOffsetDays: number, status = 'ACTIVE', revisions: unknown[] = []) => ({
  id,
  currentStep,
  status,
  nextRevisionAt: new Date(todayStart.getTime() + dueOffsetDays * DAY),
  revisions,
});

describe('getDueProblems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries ACTIVE and MASTERED problems due by the end of today', async () => {
    vi.mocked(prisma.problem.findMany).mockResolvedValue([]);
    await getDueProblems('u1', todayStart, endOfToday);
    const where = vi.mocked(prisma.problem.findMany).mock.calls[0][0]!.where;
    expect(where).toEqual({ userId: 'u1', status: { in: ['ACTIVE', 'MASTERED'] }, nextRevisionAt: { lte: endOfToday } });
  });

  it('adds lateness, recheck flag and last rating, weakest first', async () => {
    const revisedAt = new Date('2026-10-01T00:00:00Z');
    vi.mocked(prisma.problem.findMany).mockResolvedValue([
      row('a', 2, -1),
      row('b', 0, 0),
      row('c', 0, -3, 'MASTERED', [{ confidence: 'SHAKY', revisedAt }]),
    ] as never);

    const out = await getDueProblems('u1', todayStart, endOfToday);
    expect(out.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    expect(out[0]).toMatchObject({ isOverdue: true, daysOverdue: 3, isRecheck: true, lastRating: 'SHAKY', lastRevisedAt: revisedAt });
    expect(out[1]).toMatchObject({ isOverdue: false, daysOverdue: 0, isRecheck: false, lastRating: null });
    expect('revisions' in out[0]).toBe(false);
  });
});
