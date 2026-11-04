// Streak rules shared by GET /api/streak and GET /api/daily/summary.

import { prisma } from '@/lib/prisma';
import { dateKeyInTz, shiftDateKey } from '@/lib/dates';

export type StreakSummary = {
  currentStreak: number;
  bestStreak: number;
  todayCompleted: boolean;
  todayReviewed: number;
  dailyGoal: number;
  goalMet: boolean;
  goalBasedStreak: boolean;
};

type ComputeInput = {
  todayKey: string;
  /** Reviews per local day: "YYYY-MM-DD" → count. */
  countsByDay: Map<string, number>;
  /** Days marked complete in StreakLog (ignored when the streak is goal-based). */
  loggedDays?: Iterable<string>;
  dailyGoal: number;
  goalBasedStreak: boolean;
};

/** Length of the longest run of consecutive days in a set of "YYYY-MM-DD" keys. */
function longestRun(days: Set<string>): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of [...days].sort()) {
    run = previous !== null && shiftDateKey(previous, 1) === key ? run + 1 : 1;
    if (run > best) best = run;
    previous = key;
  }
  return best;
}

/**
 * Pure. A day counts toward the streak when it has at least one review — or, when the
 * streak is goal-based, at least `dailyGoal` reviews (StreakLog days are then ignored).
 * The current streak runs back from today, or from yesterday while today isn't done yet.
 */
export function computeStreak(input: ComputeInput): StreakSummary {
  const { todayKey, countsByDay, dailyGoal, goalBasedStreak } = input;
  const needed = goalBasedStreak ? Math.max(1, dailyGoal) : 1;

  const activeDays = new Set<string>();
  for (const [key, count] of countsByDay) if (count >= needed) activeDays.add(key);
  if (!goalBasedStreak) for (const key of input.loggedDays ?? []) activeDays.add(key);

  const todayReviewed = countsByDay.get(todayKey) ?? 0;
  const todayCompleted = activeDays.has(todayKey);

  let currentStreak = 0;
  for (let day = todayCompleted ? todayKey : shiftDateKey(todayKey, -1); activeDays.has(day); day = shiftDateKey(day, -1)) {
    currentStreak++;
  }

  return {
    currentStreak,
    bestStreak: longestRun(activeDays),
    todayCompleted,
    todayReviewed,
    dailyGoal,
    goalMet: todayReviewed >= dailyGoal,
    goalBasedStreak,
  };
}

/** Loads the user's review history and StreakLog and computes the streak in `tz`. */
export async function getStreakSummary(
  userId: string,
  tz: string,
  prefs: { dailyGoal: number; goalBasedStreak: boolean },
  now = new Date()
): Promise<StreakSummary> {
  const [logs, revisions] = await Promise.all([
    prefs.goalBasedStreak
      ? Promise.resolve([] as { date: Date }[])
      : prisma.streakLog.findMany({ where: { userId, completed: true }, select: { date: true } }),
    prisma.revision.findMany({ where: { problem: { userId } }, select: { revisedAt: true } }),
  ]);

  const countsByDay = new Map<string, number>();
  for (const { revisedAt } of revisions) {
    const key = dateKeyInTz(revisedAt, tz);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  return computeStreak({
    todayKey: dateKeyInTz(now, tz),
    countsByDay,
    // StreakLog dates are stored as UTC midnight of the local day.
    loggedDays: logs.map((log) => log.date.toISOString().slice(0, 10)),
    dailyGoal: prefs.dailyGoal,
    goalBasedStreak: prefs.goalBasedStreak,
  });
}
