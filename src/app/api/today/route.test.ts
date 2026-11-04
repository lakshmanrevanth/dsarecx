 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getDueProblems } from '@/app/api/problems/due/query';
import { getRevisedToday } from '@/app/api/problems/revised-today/query';
import { getStreakSummary } from '@/app/api/streak/compute';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    problem: { findMany: vi.fn() },
    studyItem: { findMany: vi.fn() },
  },
}));
vi.mock('@/app/api/problems/due/query', () => ({ getDueProblems: vi.fn() }));
vi.mock('@/app/api/problems/revised-today/query', () => ({ getRevisedToday: vi.fn() }));
vi.mock('@/app/api/streak/compute', () => ({ getStreakSummary: vi.fn() }));

const req = (cookie = 'tz=UTC') => new NextRequest('http://localhost/api/today', { headers: { cookie } });
const todayKey = () => new Date().toISOString().slice(0, 10);

const streak = { currentStreak: 5, bestStreak: 9, todayCompleted: false, todayReviewed: 2, dailyGoal: 5, goalMet: false, goalBasedStreak: false };

describe('GET /api/today', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      timezone: 'Asia/Kolkata', dailyGoal: 5, defaultPlatform: 'LEETCODE', ladderDays: [3, 7, 14, 30], goalBasedStreak: false,
    } as any);
    vi.mocked(prisma.problem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.studyItem.findMany).mockResolvedValue([]);
    vi.mocked(getDueProblems).mockResolvedValue([] as any);
    vi.mocked(getRevisedToday).mockResolvedValue([]);
    vi.mocked(getStreakSummary).mockResolvedValue(streak);
  });

  it('returns 401 when signed out', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it('splits what was learned today into DSA and system design', async () => {
    const now = new Date();
    vi.mocked(prisma.problem.findMany).mockResolvedValue([
      { id: 'p1', title: 'Two Sum', platform: 'LEETCODE', difficulty: 'EASY', topic: 'Arrays', dateSolved: now, createdAt: now },
      { id: 'c1', title: 'Sharding', platform: 'SYSTEM_DESIGN', difficulty: 'MEDIUM', topic: 'Storage', dateSolved: now, createdAt: now },
      { id: 'p2', title: 'Watermelon', platform: 'CODEFORCES', difficulty: 'EASY', topic: 'Math', dateSolved: now, createdAt: now },
    ] as any);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.today).toBe(todayKey());
    expect(json.learned.dsa.map((p: any) => p.id)).toEqual(['p1', 'p2']);
    expect(json.learned.systemDesign.map((p: any) => p.id)).toEqual(['c1']);

    // Scoped to the user and to today's local day, by the day it was learned.
    const where = vi.mocked(prisma.problem.findMany).mock.calls[0][0]!.where as any;
    expect(where.userId).toBe('u1');
    expect(where.dateSolved.gte.toISOString()).toBe(`${todayKey()}T00:00:00.000Z`);
    expect(where.dateSolved.lte.toISOString()).toBe(`${todayKey()}T23:59:59.999Z`);
  });

  it('counts revised and due today, previews the first five due, and includes the streak', async () => {
    vi.mocked(getRevisedToday).mockResolvedValue([{ id: 'r' }, { id: 's' }] as any);
    vi.mocked(getDueProblems).mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        id: `d${i}`, title: `Due ${i}`, platform: 'LEETCODE', difficulty: 'HARD', topic: 'Graphs', isOverdue: i === 0, daysOverdue: i === 0 ? 2 : 0, notes: 'secret',
      })) as any
    );

    const json = await (await GET(req())).json();
    expect(json.revisedCount).toBe(2);
    expect(json.due.count).toBe(7);
    expect(json.due.items).toHaveLength(5);
    expect(json.due.items[0]).toEqual({ id: 'd0', title: 'Due 0', platform: 'LEETCODE', difficulty: 'HARD', topic: 'Graphs', isOverdue: true, daysOverdue: 2 });
    expect(json.streak.currentStreak).toBe(5);
    expect(vi.mocked(getStreakSummary).mock.calls[0][1]).toBe('UTC');
  });

  it('returns the to-learn list in order with overdue target dates flagged', async () => {
    const base = { userId: 'u1', url: null, platform: null, identifier: null, difficulty: null, topic: null, note: null, createdAt: new Date() };
    vi.mocked(prisma.studyItem.findMany).mockResolvedValue([
      { ...base, id: 'a', kind: 'DSA', title: 'Old', order: 0, targetDate: new Date('2020-01-01T00:00:00.000Z') },
      { ...base, id: 'b', kind: 'SYSTEM_DESIGN', title: 'Now', order: 1, targetDate: new Date(`${todayKey()}T00:00:00.000Z`) },
      { ...base, id: 'c', kind: 'DSA', title: 'Later', order: 2, targetDate: null },
    ] as any);

    const json = await (await GET(req())).json();
    expect(json.toLearn.map((i: any) => [i.id, i.overdue, i.dueToday])).toEqual([
      ['a', true, false],
      ['b', false, true],
      ['c', false, false],
    ]);
    expect(vi.mocked(prisma.studyItem.findMany).mock.calls[0][0]!.where).toEqual({ userId: 'u1' });
  });

  it('falls back to the saved timezone without a tz cookie', async () => {
    await GET(req(''));
    expect(vi.mocked(getStreakSummary).mock.calls[0][1]).toBe('Asia/Kolkata');
  });

  it('returns a JSON 500 when a query fails', async () => {
    vi.mocked(getDueProblems).mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
    spy.mockRestore();
  });
});
