// Single source of truth for branding. Safe on server and client: only
// NEXT_PUBLIC_ env vars are read here.

const rawUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const url = rawUrl.replace(/\/+$/, '');

function hostOf(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return 'localhost';
  }
}

/** "owner/repo" when NEXT_PUBLIC_GITHUB_REPO is a valid value, else null. */
export function parseRepo(value: string | undefined): string | null {
  const v = (value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(v) ? v : null;
}

/** The public source repository. NEXT_PUBLIC_GITHUB_REPO overrides it (e.g. for a fork). */
const githubRepo = parseRepo(process.env.NEXT_PUBLIC_GITHUB_REPO) ?? 'lakshmanrevanth/dsarecx';

/** The developer's GitHub profile: the main contact for the project. */
const ownerGithub = 'lakshmanrevanth';

export const siteConfig = {
  name: 'dsarecx',
  logoWord: 'dsarecx',
  tagline: 'Solve it once. Recall it for good.',
  /** The tagline split for big serif headings; the last word is set in ember italic. */
  taglineLines: ['Solve it once.', 'Recall it for'],
  taglineAccent: 'good.',
  description:
    'Spaced repetition for DSA problems and system design. dsarecx schedules each review right before you would forget, so patterns stick for your interviews.',
  owner: 'Lakshman Revanth Reddy',
  contactEmail: 'revanth3527@gmail.com',
  ownerGithub,
  ownerGithubUrl: `https://github.com/${ownerGithub}`,
  url,
  host: hostOf(url),
  githubRepo,
  githubUrl: githubRepo ? `https://github.com/${githubRepo}` : null,
  license: 'MIT',
} as const;

/** Default sender for transactional email; EMAIL_FROM overrides. */
export const defaultEmailFrom = `${siteConfig.name} <noreply@${siteConfig.host}>`;

export const siteTitle = `${siteConfig.name} · ${siteConfig.tagline}`;

export type SiteConfig = typeof siteConfig;
