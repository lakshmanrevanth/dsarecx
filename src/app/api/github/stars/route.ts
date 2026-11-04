// GET /api/github/stars — star count of the repo in NEXT_PUBLIC_GITHUB_REPO ("owner/repo").
// 404 when no repo is configured; { stars: null, isFallback: true } when GitHub can't be reached.

import { parseRepo, siteConfig } from '@/config/site';

export const revalidate = 3600;

const FALLBACK_HEADERS = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' };
const SUCCESS_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };

export async function GET() {
  const repo = parseRepo(process.env.NEXT_PUBLIC_GITHUB_REPO);
  if (!repo) {
    return Response.json(
      { stars: null, repo: null, error: 'No GitHub repository configured (set NEXT_PUBLIC_GITHUB_REPO).' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const fallback = () => Response.json({ stars: null, repo, isFallback: true }, { headers: FALLBACK_HEADERS });

  try {
    const headers: Record<string, string> = {
      'User-Agent': `${siteConfig.name}-App`,
      Accept: 'application/vnd.github+json',
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers, next: { revalidate: 3600 } });
    if (!res.ok) return fallback();

    const data = await res.json();
    const stars = typeof data?.stargazers_count === 'number' ? data.stargazers_count : null;
    return Response.json({ stars, repo, isFallback: stars === null }, { headers: SUCCESS_HEADERS });
  } catch (error) {
    console.error('Error fetching GitHub stars:', error);
    return fallback();
  }
}
