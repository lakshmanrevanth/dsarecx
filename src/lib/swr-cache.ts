// SWR cache provider backed by localStorage, so pages render instantly from
// the last known data on reload. Only /api/ responses are persisted, and every
// set/delete is written through immediately (so a mutate() survives a reload).

const STORAGE_KEY = 'dsarecx_swr_cache';

type Entry = [string, unknown];

const isApiKey = (key: unknown): key is string => typeof key === 'string' && key.includes('/api/');

function readStored(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function localStorageProvider(): Map<any, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window === 'undefined') return new Map<any, any>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<any, any>(readStored());

  const persist = () => {
    try {
      const entries = Array.from(map.entries()).filter(([key]) => isApiKey(key));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Quota exceeded or storage blocked: the in-memory cache still works.
    }
  };

  const set = map.set.bind(map);
  const remove = map.delete.bind(map);

  map.set = (key, value) => {
    const result = set(key, value);
    if (isApiKey(key)) persist();
    return result;
  };
  map.delete = (key) => {
    const result = remove(key);
    if (isApiKey(key)) persist();
    return result;
  };

  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });

  return map;
}
