import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

type Entry = [path: string, changeFrequency: 'daily' | 'weekly' | 'monthly', priority: number];

// Same routes as before the rename, so existing search listings keep resolving.
const ROUTES: Entry[] = [
  ['', 'daily', 1.0],
  ['/dashboard', 'daily', 0.9],
  ['/daily', 'daily', 0.9],
  ['/about', 'weekly', 0.8],
  ['/about-us', 'weekly', 0.8],
  ['/contact', 'monthly', 0.7],
  ['/contact-us', 'monthly', 0.7],
  ['/privacy', 'monthly', 0.5],
  ['/privacy-policy', 'monthly', 0.5],
  ['/terms', 'monthly', 0.5],
  ['/terms-and-conditions', 'monthly', 0.5],
  ['/auth/login', 'monthly', 0.8],
  ['/settings', 'monthly', 0.5],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(([path, changeFrequency, priority]) => ({
    url: `${siteConfig.url}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
