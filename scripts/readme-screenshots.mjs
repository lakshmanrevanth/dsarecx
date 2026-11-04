// Builds a realistic demo account in a LOCAL database and captures the README
// screenshots into docs/screenshots/. Never point this at production: it deletes
// and recreates the demo user.
//
//   npm run db:local                         (terminal 1)
//   npm run build && npx next start -p 3200  (terminal 2, with DATABASE_URL set to the local db)
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/dsarecx node scripts/readme-screenshots.mjs
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SHOT_BASE || 'http://localhost:3200';
const OUT = path.resolve('docs/screenshots');
const EMAIL = 'demo@dsarecx.local';
const PASSWORD = 'Demo#dsarecx2026';
const LADDER = [3, 7, 14, 30];
const DAY = 864e5;

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
  console.error('Refusing to run: DATABASE_URL must point at a local database.');
  process.exit(1);
}

const prisma = new PrismaClient();
fs.mkdirSync(OUT, { recursive: true });

// Deterministic randomness, so the screenshots are reproducible.
let rngState = 20261104;
const rand = () => ((rngState = (rngState * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const daysAgo = (n, hour = 19, minute = 20) => {
  const d = new Date(startOfToday.getTime() - n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const leetcode = JSON.parse(fs.readFileSync('src/data/leetcode-problems.json', 'utf8'));
const lc = (id) => (Array.isArray(leetcode) ? leetcode : Object.values(leetcode)).find((p) => p.id === id);

// [number, topic, tags, solvedDaysAgo, notes, alwaysClean?]
const PROBLEMS = [
  [56, 'Intervals', ['blind-75'], 62, 'Sort by start; merge while next.start ≤ current.end.', true],
  [128, 'Arrays & Hashing', ['blind-75'], 60, 'Only start counting from numbers with no n - 1 in the set.', true],
  [167, 'Two Pointers', ['neetcode-150'], 58, 'Sorted input: move left up or right down by the sum.', true],
  [102, 'Trees', ['blind-75'], 57, 'BFS with a queue; record each level size before looping.', true],
  [1, 'Arrays & Hashing', ['blind-75'], 44, 'Hash map of value → index; check complement before inserting.'],
  [217, 'Arrays & Hashing', ['blind-75'], 41, 'Set; return early on the first repeat.'],
  [242, 'Arrays & Hashing', ['neetcode-150'], 39, 'Count array of 26; one pass up, one pass down.'],
  [49, 'Arrays & Hashing', ['blind-75'], 36, 'Key = sorted word (or 26-count tuple).'],
  [347, 'Heap', ['blind-75'], 33, 'Bucket sort by frequency beats a heap: O(n).'],
  [238, 'Arrays & Hashing', ['blind-75'], 30, 'Prefix pass, then suffix pass in the same output array.'],
  [125, 'Two Pointers', ['neetcode-150'], 28, 'Skip non-alphanumerics from both ends.'],
  [15, 'Two Pointers', ['blind-75'], 26, 'Sort, fix i, two pointers; skip duplicates at all three positions.'],
  [11, 'Two Pointers', ['blind-75'], 24, 'Move the shorter wall inward.'],
  [121, 'Sliding Window', ['blind-75'], 22, 'Track the minimum so far; profit = price - min.'],
  [3, 'Sliding Window', ['blind-75'], 20, 'Window with last-seen index; jump left past the repeat.'],
  [424, 'Sliding Window', ['neetcode-150'], 18, 'Window valid while len - maxFreq ≤ k; maxFreq never needs to shrink.'],
  [20, 'Stack', ['blind-75'], 16, 'Push openers; pop must match.'],
  [155, 'Stack', ['neetcode-150'], 15, 'Second stack of running minimums.'],
  [704, 'Binary Search', ['neetcode-150'], 13, 'lo ≤ hi; mid = lo + (hi - lo) / 2.'],
  [153, 'Binary Search', ['blind-75'], 12, 'Compare mid with hi to find the rotated half.'],
  [206, 'Linked List', ['blind-75'], 10, 'prev / curr / next; return prev.'],
  [21, 'Linked List', ['blind-75'], 9, 'Dummy head; splice the smaller node.'],
  [141, 'Linked List', ['blind-75'], 8, 'Floyd: slow and fast pointers.'],
  [226, 'Trees', ['blind-75'], 7, 'Swap children, recurse.'],
  [104, 'Trees', ['blind-75'], 6, 'max(depth(l), depth(r)) + 1.'],
  [200, 'Graphs', ['blind-75'], 5, 'DFS flood fill; mark visited in place.'],
  [70, 'Dynamic Programming', ['blind-75'], 4, 'Fibonacci with two variables.'],
  [198, 'Dynamic Programming', ['blind-75'], 3, 'dp[i] = max(dp[i-1], dp[i-2] + nums[i]).'],
  [322, 'Dynamic Programming', ['blind-75'], 2, 'Bottom-up min coins; init to amount + 1.'],
  // learned today
  [146, 'Linked List', ['blind-75', 'design'], 0, 'Hash map + doubly linked list; move to front on get.'],
  [207, 'Graphs', ['blind-75'], 0, 'Kahn topological sort; cycle if processed < n.'],
];

const RECALL = {
  146: ['Which two data structures give O(1) get and put?', 'What happens on put when the cache is full?', 'Why a doubly linked list rather than singly?'],
  15: ['Why sort first?', 'How do you skip duplicate triplets?', 'What is the time complexity?'],
  207: ['How do you detect a cycle with Kahn’s algorithm?', 'What does in-degree represent here?'],
};

// Replays the review ladder from the solve date up to today. Every date is in
// "days ago" form: positive = in the past, 0 = today, negative = in the future.
function simulate(solvedAgo, alwaysClean = false) {
  let step = 0;
  let status = 'ACTIVE';
  let next = solvedAgo - LADDER[0]; // when the first review falls due
  const revisions = [];
  // Review every item that fell due before today. Items due today stay in the queue.
  while (next > 0 && status === 'ACTIVE') {
    const late = rand() < 0.2 ? 1 : 0;
    const when = Math.max(1, next - late); // reviewed on (or a day after) the due date
    const r = rand();
    const confidence = alwaysClean || r < 0.66 ? 'CLEAN' : r < 0.9 ? 'SHAKY' : 'STRUGGLED';
    const before = step;
    if (confidence === 'CLEAN' && before === 3) status = 'MASTERED';
    if (confidence === 'CLEAN') step = Math.min(step + 1, 3);
    if (confidence === 'STRUGGLED') step = 0;
    revisions.push({ daysAgo: when, confidence, stepBefore: before, stepAfter: step });
    next = when - (status === 'MASTERED' ? 90 : LADDER[step]);
  }
  return { step, status, revisions, nextDaysAgo: next };
}

async function seed() {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: 'Asha Rao',
      password: await bcrypt.hash(PASSWORD, 10),
      emailVerified: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dailyGoal: 5,
    },
  });

  const blind = await prisma.problemList.create({ data: { userId: user.id, name: 'Blind 75' } });
  const neet = await prisma.problemList.create({ data: { userId: user.id, name: 'NeetCode 150' } });

  // Guarantee a few items due today and a short overdue tail.
  const forceDue = new Set([15, 3, 153, 21, 226]);
  for (const [num, topic, tags, solvedAgo, notes, alwaysClean] of PROBLEMS) {
    const meta = lc(num);
    const sim = solvedAgo === 0 ? { step: 0, status: 'ACTIVE', revisions: [], nextDaysAgo: -3 } : simulate(solvedAgo, alwaysClean);
    let nextDaysAgo = sim.nextDaysAgo;
    if (forceDue.has(num) && sim.status === 'ACTIVE') nextDaysAgo = num === 21 ? 2 : 0;
    const created = await prisma.problem.create({
      data: {
        userId: user.id,
        platform: 'LEETCODE',
        problemNumber: num,
        title: meta.title,
        url: meta.url,
        difficulty: meta.difficulty,
        topic,
        tags,
        notes,
        recallQuestions: RECALL[num] ?? [],
        dateSolved: daysAgo(solvedAgo, solvedAgo === 0 ? 10 : 20, solvedAgo === 0 ? (num === 146 ? 5 : 40) : 15),
        createdAt: solvedAgo === 0 ? daysAgo(0, 10, num === 146 ? 5 : 40) : daysAgo(solvedAgo, 20, 15),
        status: sim.status,
        currentStep: sim.step,
        revisionCount: sim.revisions.length,
        nextRevisionAt: daysAgo(nextDaysAgo, 6, 0),
        isFavorite: [146, 15, 3].includes(num),
        lists: { connect: tags.includes('neetcode-150') ? [{ id: neet.id }] : [{ id: blind.id }] },
        revisions: {
          create: sim.revisions.map((r) => ({
            revisedAt: daysAgo(r.daysAgo, 7 + Math.floor(rand() * 3), Math.floor(rand() * 59)),
            confidence: r.confidence,
            stepBefore: r.stepBefore,
            stepAfter: r.stepAfter,
            type: 'REGULAR',
          })),
        },
      },
    });
    void created;
  }

  // A couple of Codeforces / CodeChef problems so the platform mix shows.
  await prisma.problem.createMany({
    data: [
      { userId: user.id, platform: 'CODEFORCES', problemNumber: 4, code: '4A', title: 'Watermelon', url: 'https://codeforces.com/problemset/problem/4/A', difficulty: 'EASY', topic: 'Math', tags: ['cf'], dateSolved: daysAgo(11), nextRevisionAt: daysAgo(-3, 6), currentStep: 2 },
      { userId: user.id, platform: 'CODEFORCES', problemNumber: 1352, code: '1352C', title: 'K-th Not Divisible by n', url: 'https://codeforces.com/problemset/problem/1352/C', difficulty: 'MEDIUM', topic: 'Math', tags: ['cf'], dateSolved: daysAgo(6), nextRevisionAt: daysAgo(-1, 6), currentStep: 1 },
    ],
  });

  return user;
}

async function main() {
  const user = await seed();
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const settle = async () => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
  };
  const shot = async (name, opts = {}) => {
    await settle();
    await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
    console.log('saved', name);
  };
  const setTheme = async (t) => {
    await page.evaluate((v) => localStorage.setItem('theme', v), t);
    await page.reload();
  };

  // Public pages (signed out).
  await page.goto(BASE + '/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await shot('landing');
  await setTheme('dark');
  await shot('landing-dark');
  await setTheme('light');
  await page.goto(BASE + '/auth/login');
  await shot('login');

  // Sign in.
  await page.locator('#panel-signin input[type=email]').fill(EMAIL);
  await page.locator('#panel-signin input[type=password]').fill(PASSWORD);
  await page.locator('#panel-signin button[type=submit]').click();
  await page.waitForURL('**/today');

  // System design: walk the first learning path in order, plus two library concepts.
  const api = (p, body) =>
    page.evaluate(
      async ([p, body]) => {
        const r = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        return r.status;
      },
      [p, body],
    );
  for (let i = 1; i <= 6; i++) await api('/api/concepts', { pathArticleId: `system-design-fundamentals-${i}` });
  for (let i = 1; i <= 2; i++) await api('/api/concepts', { pathArticleId: `hld-interview-prep-${i}` });
  await api('/api/concepts', { slug: 'consistent-hashing' });
  await api('/api/concepts', { slug: 'cap-theorem' });
  // Spread those concepts over the last weeks; keep one as "learned today".
  const concepts = await prisma.problem.findMany({ where: { userId: user.id, platform: 'SYSTEM_DESIGN' }, orderBy: { createdAt: 'asc' } });
  const spread = [27, 23, 19, 14, 10, 7, 5, 3, 1, 0];
  for (const [i, c] of concepts.entries()) {
    const ago = spread[i] ?? 0;
    const step = ago >= 14 ? 2 : ago >= 5 ? 1 : 0;
    await prisma.problem.update({
      where: { id: c.id },
      data: {
        dateSolved: daysAgo(ago, ago === 0 ? 9 : 21, 10),
        createdAt: daysAgo(ago, ago === 0 ? 9 : 21, 10),
        currentStep: step,
        nextRevisionAt: ago === 10 ? daysAgo(0, 6) : daysAgo(-(LADDER[step] - (ago % LADDER[step])), 6),
        revisionCount: step,
        revisions: step
          ? { create: Array.from({ length: step }, (_, k) => ({ revisedAt: daysAgo(ago - LADDER[k], 8, 30), confidence: 'CLEAN', stepBefore: k, stepAfter: k + 1 })) }
          : undefined,
      },
    });
  }

  // To-learn list.
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  await api('/api/study', { kind: 'DSA', title: 'Median of Two Sorted Arrays', platform: 'LEETCODE', identifier: '4', difficulty: 'HARD', targetDate: iso(today) });
  await api('/api/study', { kind: 'DSA', title: 'Word Search II', platform: 'LEETCODE', identifier: '212', difficulty: 'HARD', topic: 'Trie' });
  await api('/api/study', { kind: 'SYSTEM_DESIGN', title: 'Design a rate limiter', targetDate: iso(new Date(today.getTime() + 2 * DAY)) });
  await api('/api/study', { kind: 'DSA', title: 'Merge k Sorted Lists', platform: 'LEETCODE', identifier: '23', difficulty: 'HARD', topic: 'Heap' });
  await api('/api/study', { kind: 'SYSTEM_DESIGN', title: 'Design a URL shortener' });

  // App pages, light.
  await page.setViewportSize({ width: 1440, height: 1640 });
  await page.goto(BASE + '/today');
  await shot('today');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/dashboard');
  await shot('dashboard');
  await page.goto(BASE + '/daily');
  await settle();
  // Open the recall step on the first card and reveal the notes.
  await page.getByRole('button', { name: /show notes panel/i }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Reveal notes/ }).first().click().catch(() => {});
  await shot('daily');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/daily');
  await settle();
  await page.keyboard.press('f');
  await shot('focus');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/concepts');
  await shot('concepts');
  await page.goto(BASE + '/stats');
  await shot('stats');
  await page.goto(BASE + '/settings');
  await shot('settings');

  // Dark mode.
  await setTheme('dark');
  await page.goto(BASE + '/dashboard');
  await shot('dashboard-dark');
  await page.goto(BASE + '/daily');
  await shot('daily-dark');
  await setTheme('light');

  // Phone.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const m = await phone.newPage();
  for (const [name, p] of [['mobile-today', '/today'], ['mobile-daily', '/daily'], ['mobile-dashboard', '/dashboard']]) {
    await m.goto(BASE + p);
    await m.waitForLoadState('networkidle');
    await m.waitForTimeout(900);
    await m.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('saved', name);
  }
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const a = await anon.newPage();
  await a.goto(BASE + '/');
  await a.waitForLoadState('networkidle');
  await a.waitForTimeout(900);
  await a.screenshot({ path: path.join(OUT, 'mobile-landing.png') });
  console.log('saved mobile-landing');

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
