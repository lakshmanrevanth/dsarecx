import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/theme-provider';
import { siteConfig, siteTitle } from '@/config/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

const siteUrl = siteConfig.url;
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

// Applies the theme before first paint. localStorage "theme" is light | dark | system.
const themeInitScript = `
(function () {
  var t = 'system';
  try { var s = localStorage.getItem('theme'); if (s === 'light' || s === 'dark' || s === 'system') t = s; } catch (e) {}
  if (t === 'system') { t = 'light'; try { t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) {} }
  var d = t === 'dark', r = document.documentElement;
  r.classList.toggle('dark', d); r.classList.toggle('light', !d); r.style.colorScheme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', d ? '#161311' : '#f0ebe1'); });
})();
`;

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0ebe1' },
    { media: '(prefers-color-scheme: dark)', color: '#161311' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s · ${siteConfig.name}` },
  description: `${siteConfig.tagline} ${siteConfig.name} uses spaced repetition to help developers retain LeetCode, Codeforces, HackerRank, GeeksforGeeks and CodeChef solutions, plus system design concepts, for coding interviews.`,
  applicationName: siteConfig.name,
  keywords: [
    siteConfig.name,
    'DSA spaced repetition',
    'LeetCode spaced repetition',
    'System design spaced repetition',
    'Active recall coding',
    'Anki for LeetCode',
    'Blind 75 revision tracker',
    'NeetCode 150 tracker',
    'Striver SDE sheet tracker',
    'Codeforces problem tracker',
    'CodeChef problem tracker',
    'GeeksforGeeks problem tracker',
    'HackerRank problem tracker',
    'Coding interview preparation',
    'Forgetting curve',
  ],
  authors: [{ name: siteConfig.owner }],
  creator: siteConfig.owner,
  category: 'Education & Developer Tools',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: siteUrl },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: siteConfig.name,
    title: siteTitle,
    description: siteConfig.description,
  },
  twitter: { card: 'summary_large_image', title: siteTitle, description: siteConfig.description },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: siteConfig.name,
      description: 'Spaced repetition for DSA problems and system design',
      inLanguage: 'en-US',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#software`,
      name: siteConfig.name,
      operatingSystem: 'Web',
      applicationCategory: 'EducationalApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Spaced repetition scheduling (3, 7, 14, 30 days, adjustable)',
        'Metadata autofill for 18,000+ indexed problems',
        'LeetCode, Codeforces, GeeksforGeeks, HackerRank and CodeChef',
        'System design concepts and learning paths',
        'Daily revision queue, streaks, heatmap and stats',
      ],
      author: { '@type': 'Person', name: siteConfig.owner },
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteConfig.name,
      url: siteUrl,
      logo: `${siteUrl}/icon-512.png`,
      ...(siteConfig.githubUrl ? { sameAs: [siteConfig.githubUrl] } : {}),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {umamiWebsiteId ? (
          <Script src="https://cloud.umami.is/script.js" data-website-id={umamiWebsiteId} strategy="afterInteractive" />
        ) : null}
        <ThemeProvider defaultTheme="system" disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
