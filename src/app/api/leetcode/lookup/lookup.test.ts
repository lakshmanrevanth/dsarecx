 
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/leetcode/lookup', { method: 'POST', body: JSON.stringify(body) });

const graphqlReply = (data: unknown) => ({ json: async () => ({ data }) });

describe('POST /api/leetcode/lookup', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires a session', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await POST(post({ query: '1' }))).status).toBe(401);
  });

  it('requires a slug or a query', async () => {
    expect((await POST(post({}))).status).toBe(400);
  });

  it('resolves by slug', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      graphqlReply({
        question: { questionFrontendId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', topicTags: [{ name: 'Array' }], isPaidOnly: false },
      })
    ) as any;
    const res = await POST(post({ titleSlug: 'two-sum' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      problemNumber: 1,
      title: 'Two Sum',
      difficulty: 'EASY',
      topic: 'Array',
      url: 'https://leetcode.com/problems/two-sum/',
    });
  });

  it('falls back to search and prefers an exact number match', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(graphqlReply({ question: null }))
      .mockResolvedValueOnce(
        graphqlReply({
          problemsetQuestionList: {
            questions: [
              { frontendQuestionId: '150', title: 'Other', titleSlug: 'other', difficulty: 'Hard', topicTags: [] },
              { frontendQuestionId: '15', title: '3Sum', titleSlug: '3sum', difficulty: 'Medium', topicTags: [] },
            ],
          },
        })
      ) as any;
    const json = await (await POST(post({ titleSlug: 'nope', query: '15' }))).json();
    expect(json).toMatchObject({ problemNumber: 15, title: '3Sum', topic: 'General', difficulty: 'MEDIUM' });
  });

  it('returns 404 for premium problems and 502 when LeetCode fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      graphqlReply({ question: { questionFrontendId: '2', title: 'P', titleSlug: 'p', difficulty: 'Easy', isPaidOnly: true } })
    ) as any;
    expect((await POST(post({ titleSlug: 'p' }))).status).toBe(404);

    global.fetch = vi.fn().mockRejectedValue(new Error('down')) as any;
    const res = await POST(post({ titleSlug: 'p' }));
    expect(res.status).toBe(502);
    expect((await res.json()).reason).toBe('lookup_failed');
  });
});
