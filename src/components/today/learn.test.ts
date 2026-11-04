import { describe, it, expect, vi } from 'vitest';
import { buildQuickAdd, learnConcept, learnDsa } from './learn';
import type { StudyItemDto } from '@/lib/study';

type Call = { url: string; body?: Record<string, unknown> };

/** A fetch stub: routes by URL prefix, records POST bodies. */
function fakeFetch(routes: Record<string, (body?: Record<string, unknown>) => { status: number; json: unknown }>) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    const { status, json } = key ? routes[key](body) : { status: 404, json: {} };
    return new Response(JSON.stringify(json), { status });
  });
  return { impl, calls };
}

const item = (over: Partial<StudyItemDto> = {}): StudyItemDto => ({
  id: 's1',
  kind: 'DSA',
  title: 'LRU Cache',
  url: null,
  platform: 'LEETCODE',
  identifier: '146',
  difficulty: null,
  topic: null,
  note: null,
  targetDate: null,
  order: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const found = { found: true, data: { title: 'LRU Cache', difficulty: 'MEDIUM', topic: 'Design', url: 'https://leetcode.com/problems/lru-cache/', problemNumber: 146 } };

describe('learnDsa', () => {
  it('looks the problem up and creates it through POST /api/problems', async () => {
    const { impl, calls } = fakeFetch({
      '/api/resolve/leetcode': () => ({ status: 200, json: found }),
      '/api/problems': () => ({ status: 201, json: { id: 'p1' } }),
    });
    const out = await learnDsa(item({ note: 'use a dll' }), undefined, impl);
    expect(out).toEqual({ status: 'learned', id: 'p1' });
    const post = calls.find((c) => c.url === '/api/problems')!;
    expect(post.body).toMatchObject({ platform: 'LEETCODE', problemNumber: 146, title: 'LRU Cache', difficulty: 'MEDIUM', notes: 'use a dll' });
  });

  it('asks for details when the lookup fails and the item lacks a link or difficulty', async () => {
    const { impl, calls } = fakeFetch({ '/api/resolve/codeforces': () => ({ status: 200, json: { found: false } }) });
    const out = await learnDsa(item({ platform: 'CODEFORCES', identifier: '9999Z', title: 'Codeforces 9999Z' }), undefined, impl);
    expect(out.status).toBe('needs-details');
    expect(calls.some((c) => c.url === '/api/problems')).toBe(false);
  });

  it('creates it from the details form, and treats a duplicate as already tracked', async () => {
    const { impl, calls } = fakeFetch({ '/api/problems': () => ({ status: 409, json: { error: 'Already tracked.' } }) });
    const out = await learnDsa(
      item({ platform: 'CODEFORCES', identifier: '9999Z' }),
      { title: 'Mystery', url: 'https://codeforces.com/problemset/problem/9999/Z', difficulty: 'HARD', topic: '' },
      impl
    );
    expect(out.status).toBe('already');
    expect(calls[0].body).toMatchObject({ platform: 'CODEFORCES', code: '9999Z', title: 'Mystery', difficulty: 'HARD' });
  });
});

describe('learnConcept', () => {
  it('uses the library slug when the title matches a built-in concept', async () => {
    const { impl, calls } = fakeFetch({ '/api/concepts': () => ({ status: 201, json: { id: 'c1' } }) });
    const out = await learnConcept(item({ kind: 'SYSTEM_DESIGN', title: 'consistent hashing', platform: null, identifier: null }), undefined, impl);
    expect(out.status).toBe('learned');
    expect(calls[0].body).toMatchObject({ slug: 'consistent-hashing' });
  });

  it('needs a category for an unknown concept, then sends it', async () => {
    const sd = item({ kind: 'SYSTEM_DESIGN', title: 'My cool idea', platform: null, identifier: null });
    const { impl, calls } = fakeFetch({ '/api/concepts': () => ({ status: 201, json: { id: 'c2' } }) });
    expect((await learnConcept(sd, undefined, impl)).status).toBe('needs-category');
    expect(calls).toHaveLength(0);
    expect((await learnConcept(sd, 'Storage', impl)).status).toBe('learned');
    expect(calls[0].body).toMatchObject({ title: 'My cool idea', category: 'Storage' });
  });
});

describe('buildQuickAdd', () => {
  it('fills a DSA item from a pasted link', async () => {
    const { impl } = fakeFetch({ '/api/leetcode/lookup': () => ({ status: 200, json: found.data }) });
    const body = await buildQuickAdd('DSA', 'https://leetcode.com/problems/lru-cache/', { platform: 'CODEFORCES', targetDate: '2026-11-10' }, impl);
    expect(body).toMatchObject({ kind: 'DSA', platform: 'LEETCODE', title: 'LRU Cache', difficulty: 'MEDIUM', targetDate: '2026-11-10' });
  });

  it('keeps a plain title as is and matches library concepts', async () => {
    const { impl } = fakeFetch({});
    expect(await buildQuickAdd('DSA', 'Sliding window practice', { platform: 'LEETCODE', targetDate: null }, impl)).toMatchObject({
      title: 'Sliding window practice',
      platform: 'LEETCODE',
    });
    expect(await buildQuickAdd('SYSTEM_DESIGN', 'consistent hashing', { platform: 'LEETCODE', targetDate: null }, impl)).toMatchObject({
      title: 'Consistent hashing',
      topic: 'Storage',
    });
    expect(impl).not.toHaveBeenCalled();
  });
});
