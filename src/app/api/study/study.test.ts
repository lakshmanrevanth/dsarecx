 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH as REORDER } from './route';
import { PATCH, DELETE } from './[id]/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { classifyDsaInput, fallbackDsaTitle, platformFromUrl, parseStudyInput } from '@/lib/study';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => {
  const client: any = {
    studyItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  client.$transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));
  return { prisma: client };
});

const db = prisma as any;
const TODAY = new Date().toISOString().slice(0, 10);
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  userId: 'u1',
  kind: 'DSA',
  title: 'LRU Cache',
  url: 'https://leetcode.com/problems/lru-cache/',
  platform: 'LEETCODE',
  identifier: '146',
  difficulty: 'MEDIUM',
  topic: 'Design',
  note: null,
  targetDate: null,
  order: 0,
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  ...over,
});

const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { cookie: 'tz=UTC' },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/study', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
    db.studyItem.create.mockImplementation(async ({ data }: any) => ({ id: 'new', createdAt: new Date(), ...data }));
    db.studyItem.update.mockImplementation(async ({ where, data }: any) => ({ ...row(), id: where.id, ...data }));
  });

  it('401 without a session on every handler', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await GET(req('/api/study'))).status).toBe(401);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: 'x' }))).status).toBe(401);
    expect((await REORDER(req('/api/study', 'PATCH', { ids: ['s1'] }))).status).toBe(401);
    expect((await PATCH(req('/api/study/s1', 'PATCH', { title: 'x' }), ctx('s1'))).status).toBe(401);
    expect((await DELETE(req('/api/study/s1', 'DELETE'), ctx('s1'))).status).toBe(401);
  });

  it('GET lists the user’s items in order with target dates flagged', async () => {
    db.studyItem.findMany.mockResolvedValue([
      row({ id: 'a', targetDate: new Date(`${day(-2)}T00:00:00.000Z`) }),
      row({ id: 'b', kind: 'SYSTEM_DESIGN', platform: null, identifier: null, difficulty: null, targetDate: new Date(`${TODAY}T00:00:00.000Z`) }),
      row({ id: 'c' }),
    ]);
    const res = await GET(req('/api/study'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(db.studyItem.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    expect(json.map((i: any) => [i.id, i.overdue, i.dueToday])).toEqual([
      ['a', true, false],
      ['b', false, true],
      ['c', false, false],
    ]);
    expect(json[1].targetDate).toBe(TODAY);
  });

  it('POST validates kind, title, link and date', async () => {
    expect((await POST(req('/api/study', 'POST', { title: 'x' }))).status).toBe(400);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: '  ' }))).status).toBe(400);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: 'x', url: 'ftp://x' }))).status).toBe(400);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: 'x', targetDate: '2026-02-31' }))).status).toBe(400);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: 'x', platform: 'TOPCODER' }))).status).toBe(400);
    expect((await POST(req('/api/study', 'POST', [1]))).status).toBe(400);
    expect(db.studyItem.create).not.toHaveBeenCalled();
  });

  it('POST appends to the end of the list', async () => {
    db.studyItem.count.mockResolvedValue(2);
    db.studyItem.findFirst.mockResolvedValue({ order: 4 });
    const res = await POST(
      req('/api/study', 'POST', { kind: 'DSA', title: ' Two Sum ', platform: 'LEETCODE', identifier: '1', targetDate: TODAY })
    );
    expect(res.status).toBe(201);
    const { data } = db.studyItem.create.mock.calls[0][0];
    expect(data).toMatchObject({ userId: 'u1', kind: 'DSA', title: 'Two Sum', platform: 'LEETCODE', identifier: '1', order: 5 });
    expect(data.targetDate.toISOString()).toBe(`${TODAY}T00:00:00.000Z`);
    const json = await res.json();
    expect(json).toMatchObject({ title: 'Two Sum', targetDate: TODAY, dueToday: true, overdue: false });
  });

  it('POST drops coding-only fields for system design and enforces the item cap', async () => {
    db.studyItem.count.mockResolvedValue(0);
    db.studyItem.findFirst.mockResolvedValue(null);
    await POST(req('/api/study', 'POST', { kind: 'SYSTEM_DESIGN', title: 'Sharding', platform: 'LEETCODE', difficulty: 'HARD' }));
    expect(db.studyItem.create.mock.calls[0][0].data).toMatchObject({ platform: null, difficulty: null, order: 0 });

    db.studyItem.count.mockResolvedValue(500);
    expect((await POST(req('/api/study', 'POST', { kind: 'DSA', title: 'x' }))).status).toBe(400);
  });

  it('PATCH /api/study reorders when every id is given once', async () => {
    db.studyItem.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect((await REORDER(req('/api/study', 'PATCH', { ids: ['a', 'b'] }))).status).toBe(400);
    expect((await REORDER(req('/api/study', 'PATCH', { ids: ['a', 'a', 'b'] }))).status).toBe(400);
    expect((await REORDER(req('/api/study', 'PATCH', { ids: ['a', 'b', 'x'] }))).status).toBe(400);
    expect(db.studyItem.update).not.toHaveBeenCalled();

    const res = await REORDER(req('/api/study', 'PATCH', { ids: ['c', 'a', 'b'] }));
    expect(res.status).toBe(200);
    expect(db.studyItem.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.order])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('PATCH /api/study/[id] updates only the user’s own item', async () => {
    db.studyItem.findFirst.mockResolvedValue(null);
    expect((await PATCH(req('/api/study/zz', 'PATCH', { title: 'New' }), ctx('zz'))).status).toBe(404);
    expect(db.studyItem.findFirst.mock.calls[0][0].where).toEqual({ id: 'zz', userId: 'u1' });

    db.studyItem.findFirst.mockResolvedValue({ id: 's1', kind: 'DSA' });
    expect((await PATCH(req('/api/study/s1', 'PATCH', {}), ctx('s1'))).status).toBe(400);
    expect((await PATCH(req('/api/study/s1', 'PATCH', { title: '' }), ctx('s1'))).status).toBe(400);

    const res = await PATCH(req('/api/study/s1', 'PATCH', { title: 'LFU Cache', targetDate: null, note: ' hard one ' }), ctx('s1'));
    expect(res.status).toBe(200);
    const { data } = db.studyItem.update.mock.calls[0][0];
    expect(data).toEqual({ title: 'LFU Cache', targetDate: null, note: 'hard one' });
    expect((await res.json()).title).toBe('LFU Cache');
  });

  it('PATCH /api/study/[id] clears coding fields when switched to system design', async () => {
    db.studyItem.findFirst.mockResolvedValue({ id: 's1', kind: 'DSA' });
    await PATCH(req('/api/study/s1', 'PATCH', { kind: 'SYSTEM_DESIGN' }), ctx('s1'));
    expect(db.studyItem.update.mock.calls[0][0].data).toMatchObject({ kind: 'SYSTEM_DESIGN', platform: null, identifier: null, difficulty: null });
  });

  it('DELETE removes the user’s item or 404s', async () => {
    db.studyItem.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect((await DELETE(req('/api/study/zz', 'DELETE'), ctx('zz'))).status).toBe(404);
    db.studyItem.deleteMany.mockResolvedValueOnce({ count: 1 });
    expect((await DELETE(req('/api/study/s1', 'DELETE'), ctx('s1'))).status).toBe(200);
    expect(db.studyItem.deleteMany.mock.calls[1][0].where).toEqual({ id: 's1', userId: 'u1' });
  });
});

describe('study input helpers', () => {
  it('detects the platform of a pasted problem link', () => {
    expect(platformFromUrl('https://leetcode.com/problems/two-sum/')).toBe('LEETCODE');
    expect(platformFromUrl('https://codeforces.com/problemset/problem/1/A')).toBe('CODEFORCES');
    expect(platformFromUrl('https://www.geeksforgeeks.org/problems/x/1')).toBe('GFG');
    expect(platformFromUrl('https://www.hackerrank.com/challenges/x')).toBe('HACKERRANK');
    expect(platformFromUrl('https://www.codechef.com/problems/FLOW001')).toBe('CODECHEF');
    expect(platformFromUrl('https://example.com/leetcode.com')).toBeNull();
    expect(platformFromUrl('two sum')).toBeNull();
  });

  it('classifies a quick-add line and builds a fallback title', () => {
    expect(classifyDsaInput('146')).toEqual({ type: 'id', value: '146' });
    expect(classifyDsaInput('1520B')).toEqual({ type: 'id', value: '1520B' });
    expect(classifyDsaInput('Two Sum')).toEqual({ type: 'title', value: 'Two Sum' });
    expect(classifyDsaInput(' https://x.com/a ').type).toBe('url');
    expect(fallbackDsaTitle('CODEFORCES', { type: 'id', value: '1520b' })).toBe('Codeforces 1520B');
    expect(fallbackDsaTitle('LEETCODE', { type: 'url', value: 'https://leetcode.com/problems/lru-cache/' })).toBe('Lru Cache');
  });

  it('parseStudyInput only returns the fields sent on an update', () => {
    expect(parseStudyInput({ note: '' }, true)).toEqual({ data: { note: null } });
    expect(parseStudyInput({ difficulty: 'easy' }, true)).toEqual({ data: { difficulty: 'EASY' } });
    expect('error' in parseStudyInput({ difficulty: 'TRIVIAL' }, true)).toBe(true);
  });
});
