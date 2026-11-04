import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// siteConfig reads NEXT_PUBLIC_GITHUB_REPO at import time, so each test loads a
// fresh copy of the module after setting the env var.
async function loadModule(repo: string) {
  vi.stubEnv('NEXT_PUBLIC_GITHUB_REPO', repo);
  vi.resetModules();
  return import('./github-star-button');
}

describe('GitHubStarButton', () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage });
  });

  it('uses the same initial markup when cached stars exist in the browser', async () => {
    const { GitHubStarButton } = await loadModule('owner/repo');
    const serverMarkup = renderToStaticMarkup(<GitHubStarButton />);

    const storage = { getItem: () => '9' };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

    expect(renderToStaticMarkup(<GitHubStarButton />)).toBe(serverMarkup);
  });

  it('renders the navbar variant linking to the configured repo', async () => {
    const { GitHubStarButton } = await loadModule('owner/repo');
    const markup = renderToStaticMarkup(<GitHubStarButton />);
    expect(markup).toContain('data-nav-github');
    expect(markup).toContain('href="https://github.com/owner/repo"');
    expect(markup).toContain('Star dsarecx on GitHub');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it('renders the sidebar variant linking to the configured repo', async () => {
    const { GitHubStarButton } = await loadModule('https://github.com/owner/repo/');
    const markup = renderToStaticMarkup(<GitHubStarButton variant="sidebar" />);
    expect(markup).toContain('data-sidebar-github');
    expect(markup).toContain('Star on GitHub');
    expect(markup).toContain('https://github.com/owner/repo');
  });

  it('falls back to the dsarecx repository when none is configured', async () => {
    const { GitHubStarButton } = await loadModule('');
    expect(renderToStaticMarkup(<GitHubStarButton />)).toContain('https://github.com/lakshmanrevanth/dsarecx');
  });

  it('formats star counts compactly', async () => {
    const { formatStars } = await loadModule('owner/repo');
    expect(formatStars(7)).toBe('7');
    expect(formatStars(1000)).toBe('1k');
    expect(formatStars(1250)).toBe('1.3k');
    expect(formatStars(2_000_000)).toBe('2M');
  });
});
