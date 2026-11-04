// Pure aggregation behind GET /api/stats. No database or framework access: the route loads a
// few narrow rows and computeStats turns them into the payload. Every day and week boundary is
// a local calendar day in the user's timezone; weeks start on Monday.

import { dateKeyInTz, shiftDateKey } from '@/lib/dates';

export type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';
export type Status = 'ACTIVE' | 'MASTERED' | 'RETIRED';
export type Kind = 'problem' | 'concept';

export type StatsProblemRow = {
  platform: string;
  status: Status;
  currentStep: number;
  nextRevisionAt: Date;
};

export type StatsRevisionRow = {
  revisedAt: Date;
  confidence: Confidence;
  problem: { platform: string; topic: string };
};

export type WeekPoint = {
  weekStart: string;
  reviews: number;
  clean: number;
  shaky: number;
  struggled: number;
  cleanRate: number | null;
};

export type WeakTopic = {
  topic: string;
  reviews: number;
  clean: number;
  shaky: number;
  struggled: number;
  cleanRate: number;
  struggleRate: number;
  kind: 'problem' | 'concept' | 'mixed';
};

export type UpcomingDay = { date: string; count: number; concepts: number };

export type KindStats = { items: number; reviews90: number; cleanRate90: number | null };

export type StatsPayload = {
  today: string;
  timeZone: string;
  ladderDays: number[];
  totals: {
    problems: number;
    concepts: number;
    active: number;
    mastered: number;
    retired: number;
    reviewsAllTime: number;
    reviewsLast30: number;
  };
  recallRate: WeekPoint[];
  overallCleanRate: number | null;
  previousCleanRate: number | null;
  /** overallCleanRate − previousCleanRate (fraction, e.g. 0.05 = +5 points); null when either side has no reviews. */
  cleanRateChange: number | null;
  reviewsLast90: number;
  weakestTopics: WeakTopic[];
  upcoming: UpcomingDay[];
  overdueCount: number;
  ladder: { steps: [number, number, number, number]; mastered: number };
  byKind: { problems: KindStats; concepts: KindStats };
};

export const WEEKS = 12;
export const UPCOMING_DAYS = 30;
export const RATE_WINDOW_DAYS = 90;
export const MIN_TOPIC_REVIEWS = 3;
export const MAX_WEAK_TOPICS = 8;

export const kindOf = (platform: string): Kind => (platform === 'SYSTEM_DESIGN' ? 'concept' : 'problem');

/** Monday of the week containing the "YYYY-MM-DD" key. */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  return shiftDateKey(key, -daysSinceMonday);
}

/** The earliest local day any stat needs revisions from (the route filters `revisedAt >=` its start). */
export function revisionWindowStartKey(todayKey: string): string {
  const previousWindowStart = shiftDateKey(todayKey, -(2 * RATE_WINDOW_DAYS - 1));
  const firstWeekStart = shiftDateKey(mondayOf(todayKey), -7 * (WEEKS - 1));
  return previousWindowStart < firstWeekStart ? previousWindowStart : firstWeekStart;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

type Tally = { reviews: number; clean: number; shaky: number; struggled: number };
const newTally = (): Tally => ({ reviews: 0, clean: 0, shaky: 0, struggled: 0 });

function count(tally: Tally, confidence: Confidence) {
  tally.reviews++;
  if (confidence === 'CLEAN') tally.clean++;
  else if (confidence === 'SHAKY') tally.shaky++;
  else tally.struggled++;
}

const clampStep = (step: number) => Math.min(3, Math.max(0, Math.trunc(step) || 0));

export type ComputeStatsInput = {
  now: Date;
  timeZone: string;
  ladderDays: readonly number[];
  problems: StatsProblemRow[];
  /** Revisions since revisionWindowStartKey(today) — older rows are ignored. */
  revisions: StatsRevisionRow[];
  reviewsAllTime: number;
};

export function computeStats(input: ComputeStatsInput): StatsPayload {
  const { now, timeZone: tz, problems, revisions } = input;
  const today = dateKeyInTz(now, tz);

  // ---- Items: totals by kind and status, and where active items sit on the ladder.
  const totals = { problems: 0, concepts: 0, active: 0, mastered: 0, retired: 0 };
  const steps: [number, number, number, number] = [0, 0, 0, 0];
  for (const p of problems) {
    if (kindOf(p.platform) === 'concept') totals.concepts++;
    else totals.problems++;

    if (p.status === 'ACTIVE') {
      totals.active++;
      steps[clampStep(p.currentStep)]++;
    } else if (p.status === 'MASTERED') {
      totals.mastered++;
    } else {
      totals.retired++;
    }
  }

  // ---- Upcoming load for the next UPCOMING_DAYS days. Overdue items land on today.
  const upcoming: UpcomingDay[] = Array.from({ length: UPCOMING_DAYS }, (_, i) => ({
    date: shiftDateKey(today, i),
    count: 0,
    concepts: 0,
  }));
  const upcomingByDate = new Map(upcoming.map((day) => [day.date, day]));
  let overdueCount = 0;
  for (const p of problems) {
    if (p.status === 'RETIRED') continue;
    let key = dateKeyInTz(p.nextRevisionAt, tz);
    if (key < today) {
      overdueCount++;
      key = today;
    }
    const day = upcomingByDate.get(key);
    if (!day) continue;
    day.count++;
    if (kindOf(p.platform) === 'concept') day.concepts++;
  }

  // ---- Revisions: weekly series, 30/90-day windows, previous 90 days, topics and kinds.
  const thisMonday = mondayOf(today);
  const recallRate: WeekPoint[] = Array.from({ length: WEEKS }, (_, i) => ({
    weekStart: shiftDateKey(thisMonday, -7 * (WEEKS - 1 - i)),
    ...newTally(),
    cleanRate: null,
  }));
  const weekByStart = new Map(recallRate.map((week) => [week.weekStart, week]));

  const start30 = shiftDateKey(today, -29);
  const start90 = shiftDateKey(today, -(RATE_WINDOW_DAYS - 1));
  const startPrevious90 = shiftDateKey(today, -(2 * RATE_WINDOW_DAYS - 1));

  let reviewsLast30 = 0;
  const current = newTally();
  const previous = newTally();
  const byKind: Record<Kind, Tally> = { problem: newTally(), concept: newTally() };
  const topics = new Map<string, Tally & { topic: string; kinds: Set<Kind> }>();

  for (const r of revisions) {
    const key = dateKeyInTz(r.revisedAt, tz);
    if (key > today) continue; // clock skew: ignore rows from the future

    const week = weekByStart.get(mondayOf(key));
    if (week) count(week, r.confidence);
    if (key >= start30) reviewsLast30++;

    if (key < start90) {
      if (key >= startPrevious90) count(previous, r.confidence);
      continue;
    }

    count(current, r.confidence);
    const kind = kindOf(r.problem.platform);
    count(byKind[kind], r.confidence);

    const name = (r.problem.topic ?? '').trim();
    if (!name) continue;
    const id = name.toLowerCase();
    let topic = topics.get(id);
    if (!topic) {
      topic = { topic: name, kinds: new Set(), ...newTally() };
      topics.set(id, topic);
    }
    count(topic, r.confidence);
    topic.kinds.add(kind);
  }
  for (const week of recallRate) week.cleanRate = ratio(week.clean, week.reviews);

  const overallCleanRate = ratio(current.clean, current.reviews);
  const previousCleanRate = ratio(previous.clean, previous.reviews);
  const cleanRateChange =
    overallCleanRate !== null && previousCleanRate !== null ? overallCleanRate - previousCleanRate : null;

  const weakestTopics: WeakTopic[] = [...topics.values()]
    .filter((t) => t.reviews >= MIN_TOPIC_REVIEWS)
    .map((t) => ({
      topic: t.topic,
      reviews: t.reviews,
      clean: t.clean,
      shaky: t.shaky,
      struggled: t.struggled,
      cleanRate: t.clean / t.reviews,
      // A shaky recall counts as half a struggle.
      struggleRate: (t.struggled + 0.5 * t.shaky) / t.reviews,
      kind: (t.kinds.size > 1 ? 'mixed' : [...t.kinds][0]) as WeakTopic['kind'],
    }))
    // A topic recalled cleanly every time isn't weak, so it never makes the list.
    .filter((t) => t.struggleRate > 0)
    .sort((a, b) => b.struggleRate - a.struggleRate || b.reviews - a.reviews || a.topic.localeCompare(b.topic))
    .slice(0, MAX_WEAK_TOPICS);

  const kindStats = (kind: Kind, items: number): KindStats => ({
    items,
    reviews90: byKind[kind].reviews,
    cleanRate90: ratio(byKind[kind].clean, byKind[kind].reviews),
  });

  return {
    today,
    timeZone: tz,
    ladderDays: [...input.ladderDays],
    totals: { ...totals, reviewsAllTime: input.reviewsAllTime, reviewsLast30 },
    recallRate,
    overallCleanRate,
    previousCleanRate,
    cleanRateChange,
    reviewsLast90: current.reviews,
    weakestTopics,
    upcoming,
    overdueCount,
    ladder: { steps, mastered: totals.mastered },
    byKind: { problems: kindStats('problem', totals.problems), concepts: kindStats('concept', totals.concepts) },
  };
}
