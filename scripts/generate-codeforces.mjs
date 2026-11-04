/**
 * Rebuilds src/data/codeforces-problems.json from the public Codeforces API.
 *
 * Entry shape: { id, numericId, contestId, index, title, difficulty, rating, topic, url }
 * Difficulty comes from the rating: < 1200 EASY, > 1700 HARD, otherwise MEDIUM.
 *
 * Run: node scripts/generate-codeforces.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'codeforces-problems.json',
);

function difficultyFor(rating) {
  if (!rating) return 'MEDIUM';
  if (rating < 1200) return 'EASY';
  if (rating > 1700) return 'HARD';
  return 'MEDIUM';
}

// Kept identical to the existing dataset so stored problem numbers stay stable:
// contestId * 100 + letter position (A = 1), falling back to 1.
function numericIdFor(contestId, index) {
  const letter = index ? index.charCodeAt(0) - 64 : 1;
  return contestId * 100 + (letter > 0 && letter < 30 ? letter : 1);
}

async function main() {
  console.log('Fetching the Codeforces problemset...');
  const res = await fetch('https://codeforces.com/api/problemset.problems');
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Codeforces API error: ${data.comment ?? data.status}`);

  const problems = data.result.problems.map((p) => ({
    id: `${p.contestId}${p.index}`,
    numericId: numericIdFor(p.contestId, p.index),
    contestId: p.contestId,
    index: p.index,
    title: p.name,
    difficulty: difficultyFor(p.rating),
    rating: p.rating ?? null,
    topic: p.tags?.[0] ?? 'General',
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
  }));

  fs.writeFileSync(OUTPUT, JSON.stringify(problems, null, 2));
  console.log(`Saved ${problems.length} Codeforces problems to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
