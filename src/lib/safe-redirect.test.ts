import { describe, it, expect } from 'vitest';
import { safeCallbackUrl } from './safe-redirect';

describe('safeCallbackUrl', () => {
  it('keeps same-site paths', () => {
    expect(safeCallbackUrl('/daily?x=1')).toBe('/daily?x=1');
  });
  it('rejects other sites', () => {
    expect(safeCallbackUrl('https://evil.com')).toBe('/today');
    expect(safeCallbackUrl('//evil.com')).toBe('/today');
    expect(safeCallbackUrl('/\\evil.com')).toBe('/today');
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/today');
  });
  it('falls back when missing', () => {
    expect(safeCallbackUrl(null)).toBe('/today');
  });
});
