import { describe, expect, it } from 'vitest';
import { lookupDemo, nextInterval, ratingOutcome } from './demo-data';
import { REVIEW_DAYS, retentionWithReviews, retentionWithoutReview } from './retention-chart';
import { buildMailto } from './contact-form';

describe('demo scheduling', () => {
  it('follows the ladder rules', () => {
    expect(nextInterval(0, 'clean')).toBe(7);
    expect(nextInterval(2, 'clean')).toBe(30);
    expect(nextInterval(3, 'clean')).toBe(0);
    expect(ratingOutcome(3, 'clean')).toBe('Mastered');
    expect(nextInterval(2, 'shaky')).toBe(14);
    expect(nextInterval(3, 'struggled')).toBe(3);
  });
});

describe('lookupDemo', () => {
  it('finds by number, code, slug URL and title', () => {
    expect(lookupDemo('42')?.title).toBe('Trapping Rain Water');
    expect(lookupDemo('4a')?.platform).toBe('Codeforces');
    expect(lookupDemo('https://leetcode.com/problems/3sum/')?.title).toBe('3Sum');
    expect(lookupDemo('codeforces.com/problemset/problem/4/A')?.title).toBe('Watermelon');
    expect(lookupDemo('lru')?.title).toBe('LRU Cache');
    expect(lookupDemo('99999')).toBeNull();
    expect(lookupDemo('  ')).toBeNull();
  });
});

describe('retention model', () => {
  it('reviews on cumulative ladder days and restores recall', () => {
    expect(REVIEW_DAYS).toEqual([3, 10, 24, 54]);
    expect(retentionWithoutReview(2)).toBeCloseTo(0.3, 1);
    expect(retentionWithReviews(3)).toBe(1);
    expect(retentionWithReviews(9.9)).toBeGreaterThan(retentionWithoutReview(9.9));
  });
});

describe('buildMailto', () => {
  it('encodes subject and body', () => {
    const url = buildMailto('Ada', 'ada@example.com', 'Hi & bye');
    expect(url.startsWith('mailto:')).toBe(true);
    expect(url).toContain(encodeURIComponent('dsarecx message from Ada'));
    expect(url).toContain(encodeURIComponent('Hi & bye'));
  });
});
