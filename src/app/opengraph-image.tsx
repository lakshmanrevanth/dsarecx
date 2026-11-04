import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Palette from DESIGN.md: paper background, card panel, ink text, ember accent.
const PAPER = '#f0ebe1';
const CARD = '#fbf8f2';
const INK = '#161311';
const EMBER = '#ff6a1f';
const MUTED = '#5c544c';
const RULE = '#d9d0c1';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 48,
          background: PAPER,
          fontFamily: 'Georgia, "Times New Roman", serif',
          color: INK,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 72px',
            background: CARD,
            border: `2px solid ${RULE}`,
            borderRadius: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: EMBER, marginRight: 16 }} />
            {siteConfig.logoWord}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {siteConfig.taglineLines.map((line, i) => (
              <div
                key={line}
                style={{ display: 'flex', fontSize: 100, lineHeight: 1.04, letterSpacing: '-0.035em' }}
              >
                {line}
                {i === siteConfig.taglineLines.length - 1 && (
                  <span style={{ color: EMBER, fontStyle: 'italic', marginLeft: 26 }}>{siteConfig.taglineAccent}</span>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 28,
              color: MUTED,
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            }}
          >
            <span>Spaced repetition for DSA problems and system design.</span>
            <span style={{ color: INK }}>{siteConfig.host}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
