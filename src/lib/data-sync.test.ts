import { afterEach, describe, expect, it, vi } from 'vitest';
import { installDataSync, isDataKey, isDataWrite } from './data-sync';

const ORIGIN = 'http://localhost:3000';

describe('isDataKey', () => {
  it('matches every study-data response, including sub-paths and query strings', () => {
    for (const k of ['/api/problems', '/api/problems/due', '/api/concepts', '/api/today', '/api/study', '/api/stats?range=30', '/api/daily/summary', ['/api/problems', { q: 1 }]]) {
      expect(isDataKey(k)).toBe(true);
    }
  });
  it('ignores unrelated keys', () => {
    for (const k of ['/api/github/stars', '/api/auth/session', '/api/problemsX', 'theme', null, 42]) {
      expect(isDataKey(k)).toBe(false);
    }
  });
});

describe('isDataWrite', () => {
  it('treats same-origin API writes as data changes', () => {
    expect(isDataWrite('/api/problems', 'POST', ORIGIN)).toBe(true);
    expect(isDataWrite('/api/problems/abc/revise', 'patch', ORIGIN)).toBe(true);
    expect(isDataWrite(`${ORIGIN}/api/concepts`, 'POST', ORIGIN)).toBe(true);
    expect(isDataWrite('/api/study/1', 'DELETE', ORIGIN)).toBe(true);
  });
  it('ignores reads, auth, GitHub and other origins', () => {
    expect(isDataWrite('/api/problems', 'GET', ORIGIN)).toBe(false);
    expect(isDataWrite('/api/problems', undefined, ORIGIN)).toBe(false);
    expect(isDataWrite('/api/auth/signup', 'POST', ORIGIN)).toBe(false);
    expect(isDataWrite('/api/github/stars', 'POST', ORIGIN)).toBe(false);
    expect(isDataWrite('https://leetcode.com/graphql', 'POST', ORIGIN)).toBe(false);
    expect(isDataWrite('/dashboard', 'POST', ORIGIN)).toBe(false);
  });
});

describe('installDataSync', () => {
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  afterEach(() => {
    vi.useRealTimers();
    globalThis.window = realWindow;
    globalThis.document = realDocument;
  });

  function setup(status = 200) {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response('{}', { status }));
    // Minimal browser globals for the node test environment.
    globalThis.window = { fetch: fetchMock, location: { origin: ORIGIN } } as unknown as typeof window;
    globalThis.document = { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Document;
    const revalidate = vi.fn();
    const uninstall = installDataSync(revalidate);
    return { revalidate, uninstall, fetchMock };
  }

  it('revalidates all study data once after a burst of successful writes', async () => {
    const { revalidate, uninstall } = setup();
    await window.fetch('/api/problems', { method: 'POST' });
    await window.fetch('/api/concepts', { method: 'POST' });
    vi.advanceTimersByTime(200);
    expect(revalidate).toHaveBeenCalledTimes(1);
    const matcher = revalidate.mock.calls[0][0];
    expect(matcher('/api/concepts')).toBe(true);
    expect(matcher('/api/problems')).toBe(true);
    uninstall();
  });

  it('does nothing for reads or failed writes, and uninstall restores fetch', async () => {
    const { revalidate, uninstall, fetchMock } = setup(400);
    await window.fetch('/api/problems');
    await window.fetch('/api/problems', { method: 'POST' });
    vi.advanceTimersByTime(200);
    expect(revalidate).not.toHaveBeenCalled();
    uninstall();
    expect(window.fetch).toBe(fetchMock);
  });
});
