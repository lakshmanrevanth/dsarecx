// Sample data for the landing-page demos. Nothing here is fetched; it only has
// to look like a believable week of revision.

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Platform = 'LeetCode' | 'Codeforces' | 'GFG' | 'HackerRank' | 'CodeChef' | 'System design';
export type Rating = 'struggled' | 'shaky' | 'clean';

export const LADDER_DAYS = [3, 7, 14, 30] as const;

export const PLATFORMS: { name: Platform; logo: string; logoDark?: string; count: string }[] = [
  { name: 'LeetCode', logo: '/leetcode.svg', logoDark: '/leetcode-dark.svg', count: '2.8k' },
  { name: 'Codeforces', logo: '/codeforces.svg', count: '11.3k' },
  { name: 'CodeChef', logo: '/codechef.svg', logoDark: '/codechef-dark.svg', count: '4.8k' },
  { name: 'GFG', logo: '/gfg.svg', count: 'seed' },
  { name: 'HackerRank', logo: '/HackerRank.png', count: 'seed' },
];

export type DemoProblem = {
  /** What the user types to find it: a LeetCode number or a Codeforces code. */
  key: string;
  title: string;
  platform: Platform;
  difficulty: Difficulty;
  topic: string;
  pattern: string;
};

/** A small local "index" for the table demo's autofill. */
export const DEMO_INDEX: DemoProblem[] = [
  { key: '1', title: 'Two Sum', platform: 'LeetCode', difficulty: 'Easy', topic: 'Hash map', pattern: 'Complement lookup' },
  { key: '15', title: '3Sum', platform: 'LeetCode', difficulty: 'Medium', topic: 'Two pointers', pattern: 'Sort + squeeze' },
  { key: '42', title: 'Trapping Rain Water', platform: 'LeetCode', difficulty: 'Hard', topic: 'Two pointers', pattern: 'Max from both sides' },
  { key: '146', title: 'LRU Cache', platform: 'LeetCode', difficulty: 'Medium', topic: 'Design', pattern: 'Hash map + DLL' },
  { key: '200', title: 'Number of Islands', platform: 'LeetCode', difficulty: 'Medium', topic: 'Graphs', pattern: 'Flood fill' },
  { key: '300', title: 'Longest Increasing Subsequence', platform: 'LeetCode', difficulty: 'Medium', topic: 'DP', pattern: 'Patience sort' },
  { key: '4A', title: 'Watermelon', platform: 'Codeforces', difficulty: 'Easy', topic: 'Math', pattern: 'Parity' },
  { key: '1462E', title: 'Close Tuples', platform: 'Codeforces', difficulty: 'Medium', topic: 'Combinatorics', pattern: 'Sliding window + nCr' },
];

export type TableRow = DemoProblem & { id: string; nextReview: string; step: number };

export const INITIAL_ROWS: TableRow[] = [
  { ...DEMO_INDEX[3], id: 'r1', nextReview: 'Today', step: 2 },
  { ...DEMO_INDEX[1], id: 'r2', nextReview: 'Tomorrow', step: 1 },
  { ...DEMO_INDEX[6], id: 'r3', nextReview: 'In 12 days', step: 3 },
];

export type QueueItem = {
  id: string;
  title: string;
  platform: Platform;
  difficulty: Difficulty | null;
  topic: string;
  step: number;
  late?: number;
  question: string;
  notes: string;
};

export const QUEUE: QueueItem[] = [
  {
    id: 'q1',
    title: 'Course Schedule',
    platform: 'LeetCode',
    difficulty: 'Medium',
    topic: 'Graphs',
    step: 1,
    late: 2,
    question: 'How do you detect that the prerequisites contain a cycle?',
    notes: "Kahn's algorithm: push in-degree 0 nodes, pop and decrement. If fewer than n nodes are processed, there is a cycle.",
  },
  {
    id: 'q2',
    title: 'Consistent hashing',
    platform: 'System design',
    difficulty: null,
    topic: 'Distributed systems',
    step: 2,
    question: 'Why do virtual nodes make the key distribution more even?',
    notes: 'Each server owns many small arcs of the ring, so adding or removing one moves ~1/n of the keys and load evens out.',
  },
  {
    id: 'q3',
    title: 'Koko Eating Bananas',
    platform: 'LeetCode',
    difficulty: 'Medium',
    topic: 'Binary search',
    step: 0,
    question: 'What are you binary searching over, and what is the predicate?',
    notes: 'Search the speed k in [1, max(piles)]. Predicate: sum(ceil(p / k)) <= h. Find the smallest k that passes.',
  },
];

/** Days until the next review for each rating, from a given ladder step. */
export function nextInterval(step: number, rating: Rating): number {
  if (rating === 'struggled') return LADDER_DAYS[0];
  if (rating === 'shaky') return LADDER_DAYS[Math.min(step, LADDER_DAYS.length - 1)];
  return step >= LADDER_DAYS.length - 1 ? 0 : LADDER_DAYS[step + 1];
}

export function ratingOutcome(step: number, rating: Rating): string {
  const days = nextInterval(step, rating);
  if (days === 0) return 'Mastered';
  return `in ${days}d`;
}

export function difficultyChip(d: Difficulty | null): string {
  if (d === 'Easy') return 'chip-easy';
  if (d === 'Medium') return 'chip-medium';
  if (d === 'Hard') return 'chip-hard';
  return '';
}

/** Find a demo problem by number, code, or a pasted URL. */
export function lookupDemo(query: string): DemoProblem | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const fromUrl = q.match(/problems\/([a-z0-9-]+)/)?.[1] ?? q.match(/problemset\/problem\/(\d+)\/([a-z]\d?)/)?.slice(1).join('');
  const needle = (fromUrl ?? q).replace(/^#/, '');
  return (
    DEMO_INDEX.find((p) => p.key.toLowerCase() === needle) ??
    DEMO_INDEX.find((p) => p.title.toLowerCase().replace(/\s+/g, '-') === needle) ??
    DEMO_INDEX.find((p) => needle.length >= 3 && p.title.toLowerCase().includes(needle)) ??
    null
  );
}
