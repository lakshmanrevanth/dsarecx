// One sync layer for all study data.
//
// Problems, system design concepts, the to-learn list, the daily queue, streaks and
// stats all live in the same database rows (a concept is a Problem with platform
// SYSTEM_DESIGN), but each page caches its own API responses in SWR. Without a
// shared rule, a change on one page left the others showing stale data.
//
// The rule: after any successful write to the API (POST, PUT, PATCH, DELETE), every
// cached study-data response is revalidated from the server, in this tab and in
// every other open tab. Pages keep their optimistic updates; the server answer then
// replaces them everywhere.

type Matcher = (key: unknown) => boolean;
type Revalidate = (matcher: Matcher) => unknown;

/** API responses that are derived from the user's study data. */
export const DATA_KEY_PREFIXES = [
  '/api/problems',
  '/api/concepts',
  '/api/study',
  '/api/today',
  '/api/daily',
  '/api/streak',
  '/api/activity',
  '/api/stats',
  '/api/lists',
  '/api/columns',
  '/api/settings',
] as const;

/** Writes to these never change study data (sign-in, verification codes, GitHub stars). */
const IGNORED_WRITE_PREFIXES = ['/api/auth', '/api/github'];

const CHANNEL = 'dsarecx-data';
const COALESCE_MS = 120;

function pathOf(key: unknown): string | null {
  if (typeof key === 'string') return key;
  // SWR array keys: ['/api/problems', params]
  if (Array.isArray(key) && typeof key[0] === 'string') return key[0];
  return null;
}

export function isDataKey(key: unknown): boolean {
  const path = pathOf(key);
  return !!path && DATA_KEY_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
}

/** Is this request a write that changes study data? */
export function isDataWrite(url: string, method: string | undefined, origin: string): boolean {
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  let path: string;
  try {
    const u = new URL(url, origin);
    if (u.origin !== origin) return false;
    path = u.pathname;
  } catch {
    return false;
  }
  if (!path.startsWith('/api/')) return false;
  return !IGNORED_WRITE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

function requestInfo(input: RequestInfo | URL, init?: RequestInit): { url: string; method?: string } {
  if (typeof input === 'string') return { url: input, method: init?.method };
  if (input instanceof URL) return { url: input.href, method: init?.method };
  return { url: input.url, method: init?.method ?? input.method };
}

/**
 * Installs the sync layer in the browser. Returns an uninstall function.
 * `revalidate` is SWR's global mutate.
 */
export function installDataSync(revalidate: Revalidate): () => void {
  if (typeof window === 'undefined') return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  const refreshAll = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      revalidate(isDataKey);
    }, COALESCE_MS);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => refreshAll();
  } catch {
    // No BroadcastChannel (very old browsers): other tabs refresh on focus instead.
  }

  const originalFetch = window.fetch;
  const syncedFetch: typeof fetch = async (input, init) => {
    const res = await originalFetch(input, init);
    try {
      const { url, method } = requestInfo(input, init);
      if (res.ok && isDataWrite(url, method, window.location.origin)) {
        refreshAll();
        channel?.postMessage('changed');
      }
    } catch {
      // Never let sync bookkeeping break the request itself.
    }
    return res;
  };
  window.fetch = syncedFetch;

  // Coming back to a tab that sat in the background: pull fresh data.
  const onVisible = () => {
    if (document.visibilityState === 'visible') refreshAll();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    if (window.fetch === syncedFetch) window.fetch = originalFetch;
    document.removeEventListener('visibilitychange', onVisible);
    channel?.close();
    if (timer) clearTimeout(timer);
  };
}
