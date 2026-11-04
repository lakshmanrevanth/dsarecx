/**
 * Rebuilds src/data/codechef-problems.json from CodeChef's public problem list.
 *
 * Entry shape: { code, numericId, title, difficulty, topic, url }
 * numericId is a djb2 hash of the upper-cased code (the resolver uses the same hash).
 *
 * Run: node scripts/generate-codechef.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'codechef-problems.json',
);
const BASE_URL = 'https://www.codechef.com/api/list/problems';
const PAGE_SIZE = 20;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2000;

const CATEGORY_DIFFICULTY = {
  school: 'EASY',
  beginner: 'EASY',
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  challenge: 'HARD',
  extco: 'HARD',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hashCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function fetchPage(category, page) {
  const url = `${BASE_URL}?category=${category}&page=${page}&limit=${PAGE_SIZE}&search=`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 dsarecx-dataset/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`  [${attempt}/${MAX_RETRIES}] ${err.message} (${category}, page ${page})`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return null;
}

function toEntry(p, category) {
  const code = String(p.code || p.problem_code || '').toUpperCase();
  const title = p.name || p.problem_name || p.title;
  if (!code || !title) return null;
  const tags =
    Array.isArray(p.tags) && p.tags.length ? p.tags : Array.isArray(p.topic_tags) ? p.topic_tags : [];
  return {
    code,
    numericId: hashCode(code),
    title,
    difficulty: CATEGORY_DIFFICULTY[category] ?? 'MEDIUM',
    topic: tags[0] ?? 'General',
    url: `https://www.codechef.com/problems/${code}`,
  };
}

async function fetchCategory(category) {
  const first = await fetchPage(category, 1);
  if (!first?.data) {
    console.warn(`No data for category '${category}'`);
    return [];
  }
  const total = first.total ?? first.count ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  console.log(`\n[${category}] ${total} problems across ${pages} pages`);

  const rows = [...first.data];
  for (let page = 2; page <= pages; page++) {
    process.stdout.write(`  page ${page}/${pages}\r`);
    const data = await fetchPage(category, page);
    if (!data?.data) break;
    rows.push(...data.data);
    await sleep(300); // be polite
  }
  return rows.map((p) => toEntry(p, category)).filter(Boolean);
}

async function main() {
  const byCode = new Map();
  for (const category of Object.keys(CATEGORY_DIFFICULTY)) {
    for (const entry of await fetchCategory(category)) {
      if (!byCode.has(entry.code)) byCode.set(entry.code, entry);
    }
  }
  const problems = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(problems, null, 2), 'utf8');
  console.log(`\nSaved ${problems.length} CodeChef problems to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
