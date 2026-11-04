/**
 * Rebuilds src/data/leetcode-problems.json from the kaysss/leetcode-problem-set
 * dataset (HuggingFace datasets-server rows API). Paid-only problems are skipped.
 *
 * Entry shape: { id, title, slug, difficulty, topic, url }
 *
 * Resumable: node scripts/download-leetcode-dataset.mjs [startOffset]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const OUTPUT = path.join(DATA_DIR, 'leetcode-problems.json');
const CHECKPOINT = path.join(DATA_DIR, 'leetcode-problems.checkpoint.json');

const API = 'https://datasets-server.huggingface.co/rows';
const DATASET = 'kaysss/leetcode-problem-set';
const BATCH = 100;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const START = Number.parseInt(process.argv[2] ?? '0', 10) || 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(offset) {
  const url = `${API}?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&limit=${BATCH}`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = await res.text();
    console.error(`\n[${attempt}/${MAX_RETRIES}] HTTP ${res.status} at offset ${offset}`);
    if (attempt === MAX_RETRIES) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    await sleep(RETRY_DELAY_MS * attempt);
  }
}

function firstTopic(tags) {
  let list = tags;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return 'General';
    }
  }
  if (!Array.isArray(list) || list.length === 0) return 'General';
  const first = list[0];
  return typeof first === 'string' ? first : first?.name ?? 'General';
}

function toEntry({ row: r }) {
  if (r.paidOnly === true || r.frontendQuestionId == null) return null;
  const id = Number.parseInt(r.frontendQuestionId, 10);
  const difficulty = String(r.difficulty || '').toUpperCase();
  if (Number.isNaN(id) || !['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) return null;
  const slug = r.titleSlug || '';
  return {
    id,
    title: r.title || '',
    slug,
    difficulty,
    topic: firstTopic(r.topicTags),
    url: `https://leetcode.com/problems/${slug}/`,
  };
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const problems =
    START > 0 && fs.existsSync(CHECKPOINT) ? JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) : [];
  console.log(START > 0 ? `Resuming at ${START} with ${problems.length} kept` : 'Starting fresh download...');

  const keep = (rows) => {
    for (const row of rows) {
      const entry = toEntry(row);
      if (entry) problems.push(entry);
    }
  };

  const first = await fetchBatch(START);
  const total = first.num_rows_total;
  console.log(`Dataset rows: ${total}`);
  keep(first.rows);

  for (let i = Math.ceil(START / BATCH) + 1; i < Math.ceil(total / BATCH); i++) {
    const offset = i * BATCH;
    process.stdout.write(`\rRows ${offset}-${Math.min(offset + BATCH, total)} of ${total}`);
    keep((await fetchBatch(offset)).rows);
    if (i % 5 === 0) fs.writeFileSync(CHECKPOINT, JSON.stringify(problems, null, 2), 'utf8');
  }

  problems.sort((a, b) => a.id - b.id);
  fs.writeFileSync(OUTPUT, JSON.stringify(problems, null, 2), 'utf8');
  if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
  console.log(`\nSaved ${problems.length} LeetCode problems to ${OUTPUT}`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
