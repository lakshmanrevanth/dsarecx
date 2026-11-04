// User preferences, stored as columns on the User row.
// Server code whose behaviour depends on a setting (review ladder, daily goal,
// timezone, streak mode) reads them through getUserPreferences().

import { prisma } from '@/lib/prisma';
import { normalizeLadder, type Ladder } from '@/lib/scheduling';
import { isValidTimeZone } from '@/lib/dates';

export type Platform = 'LEETCODE' | 'CODEFORCES' | 'GFG' | 'HACKERRANK' | 'CODECHEF';
export const PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];

export type UserPreferences = {
  timezone: string | null;
  dailyGoal: number;
  defaultPlatform: Platform;
  ladderDays: Ladder;
  /** true: a day counts toward the streak only when the daily goal is met. */
  goalBasedStreak: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: null,
  dailyGoal: 5,
  defaultPlatform: 'LEETCODE',
  ladderDays: [3, 7, 14, 30],
  goalBasedStreak: false,
};

export const PREFERENCE_SELECT = {
  timezone: true,
  dailyGoal: true,
  defaultPlatform: true,
  ladderDays: true,
  goalBasedStreak: true,
} as const;

type PreferenceRow = {
  timezone: string | null;
  dailyGoal: number;
  defaultPlatform: string;
  ladderDays: number[];
  goalBasedStreak: boolean;
};

const isPlatform = (value: unknown): value is Platform => (PLATFORMS as unknown[]).includes(value);

/** Turns a stored row into preferences, replacing any invalid value with its default. */
export function toPreferences(row: PreferenceRow | null | undefined): UserPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    timezone: isValidTimeZone(row.timezone) ? row.timezone : null,
    dailyGoal: row.dailyGoal > 0 ? row.dailyGoal : DEFAULT_PREFERENCES.dailyGoal,
    defaultPlatform: isPlatform(row.defaultPlatform) ? row.defaultPlatform : DEFAULT_PREFERENCES.defaultPlatform,
    ladderDays: normalizeLadder(row.ladderDays),
    goalBasedStreak: row.goalBasedStreak,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: PREFERENCE_SELECT });
  return toPreferences(row);
}

/**
 * Validates a partial preferences update from the client.
 * Returns only the fields that were sent, or the first validation error.
 */
export function parsePreferencesUpdate(
  body: Record<string, unknown>
): { data: Partial<Omit<UserPreferences, 'ladderDays'> & { ladderDays: number[] }> } | { error: string } {
  const data: Record<string, unknown> = {};

  if ('timezone' in body) {
    if (body.timezone !== null && !isValidTimeZone(String(body.timezone))) return { error: 'Unknown timezone' };
    data.timezone = body.timezone;
  }
  if ('dailyGoal' in body) {
    const goal = Number(body.dailyGoal);
    if (!Number.isInteger(goal) || goal < 1 || goal > 200) return { error: 'Daily goal must be between 1 and 200' };
    data.dailyGoal = goal;
  }
  if ('defaultPlatform' in body) {
    if (!isPlatform(body.defaultPlatform)) return { error: 'Unknown platform' };
    data.defaultPlatform = body.defaultPlatform;
  }
  if ('ladderDays' in body) {
    const requested = Array.isArray(body.ladderDays) ? body.ladderDays.map(Number) : [];
    const ladder = normalizeLadder(requested);
    // normalizeLadder falls back to the default on bad input, so any difference means the input was invalid.
    if (ladder.join() !== requested.join()) {
      return { error: 'Intervals must be 4 increasing whole numbers of days between 1 and 365' };
    }
    data.ladderDays = [...ladder];
  }
  if ('goalBasedStreak' in body) data.goalBasedStreak = Boolean(body.goalBasedStreak);

  return { data };
}
