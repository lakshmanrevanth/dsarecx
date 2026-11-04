/* eslint-disable @typescript-eslint/no-explicit-any -- validates untrusted JSON from uploaded files */
// POST /api/problems/import — bulk import from CSV / Excel rows or a JSON backup (v2).
// Body: ImportRequestBody (see src/lib/import-utils.ts). Everything runs in one transaction,
// so a failed import changes nothing.
//
// Duplicates (same platform + number as a tracked problem) follow duplicateStrategy:
//   skip      — leave the tracked problem alone
//   merge     — fill empty fields, keep the more advanced schedule, add missing revisions
//   overwrite — replace fields and (for backups) the revision history
//
// A backup's to-learn list (studyItems) is added after the current one; an item
// with the same kind and title as one already there is skipped.

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  MAX_IMPORT_ROWS,
  MAX_REVISIONS_PER_PROBLEM,
  buildDuplicateUpdate,
  parseList,
  type DuplicateStrategy,
  type ImportColumnDef,
  type ImportedRevision,
  type ProcessedProblem,
} from '@/lib/import-utils';
import {
  MAX_COLUMNS,
  isColumnType,
  normalizeOptions,
  parseCustomValue,
  readCustomFields,
  toCustomColumn,
  type CustomColumn,
} from '@/lib/custom-columns';
import { MAX_STUDY_ITEMS, dayKeyToDate, parseStudyInput, type StudyFields } from '@/lib/study';
import { badRequest, currentUserId, jsonError, unauthorized } from '../../_shared/http';

type Tx = Prisma.TransactionClient;

const VALID_PLATFORMS = new Set(['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF', 'SYSTEM_DESIGN']);
const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VALID_STATUSES = new Set(['ACTIVE', 'MASTERED', 'RETIRED']);
const VALID_CONFIDENCE = new Set(['CLEAN', 'SHAKY', 'STRUGGLED']);
const DUPLICATE_STRATEGIES = new Set<DuplicateStrategy>(['skip', 'overwrite', 'merge']);
const PROBLEM_BATCH = 200;
const REVISION_BATCH = 1000;
const MAX_LISTS = 100;
const MAX_STREAK_DAYS = 5000;
const MAX_COLUMN_NAME = 40;
const MAX_INT = 2147483647;

/** A validated row, keyed by "PLATFORM:number". */
type Row = ProcessedProblem & { key: string; defaulted?: string[] };
type StreakEntry = { date: string; completed: boolean };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const trimTo = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isInt = (n: unknown, min: number, max: number): n is number =>
  Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

/**
 * Postgres rejects timestamps outside its range (JS accepts years like -200000),
 * which would abort the whole transaction with a 500.
 */
function inRange(d: Date): boolean {
  const y = d.getUTCFullYear();
  return !isNaN(d.getTime()) && y >= 1900 && y <= 9999;
}

/** A real calendar day: "2024-02-31" or "2024-13-01" would roll over or fail the insert. */
function isRealDay(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00.000Z`);
  return inRange(d) && d.toISOString().slice(0, 10) === key;
}

/** Valid revisions only (at most MAX_REVISIONS_PER_PROBLEM); invalid ones are dropped. */
function cleanRevisions(input: unknown): ImportedRevision[] {
  if (!Array.isArray(input)) return [];
  const step = (n: unknown) => (isInt(n, 0, 3) ? n : 0);
  const out: ImportedRevision[] = [];
  for (const r of input.slice(0, MAX_REVISIONS_PER_PROBLEM)) {
    const at = new Date(r?.revisedAt);
    if (!inRange(at) || !VALID_CONFIDENCE.has(r?.confidence)) continue;
    out.push({
      revisedAt: at.toISOString(),
      confidence: r.confidence,
      type: r.type === 'RECHECK' ? 'RECHECK' : 'REGULAR',
      stepBefore: step(r.stepBefore),
      stepAfter: step(r.stepAfter),
    });
  }
  return out;
}

const stringsIn = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : null;

/** Validates one incoming problem (row numbers are 1-based); returns an error message or the row. */
function cleanRow(p: any, row: number): Row | string {
  if (!p || typeof p !== 'object') return `Problem at row ${row} is not an object`;
  const title = trimTo(p.title, 300);
  if (!title) return `Problem at row ${row} is missing a title`;
  if (!VALID_PLATFORMS.has(p.platform)) return `Problem at row ${row} has invalid platform "${p.platform}"`;
  if (!isInt(p.problemNumber, 1, MAX_INT)) return `Problem at row ${row} has invalid problemNumber`;
  if (!VALID_DIFFICULTIES.has(p.difficulty)) return `Problem at row ${row} has invalid difficulty "${p.difficulty}"`;
  const dateSolved = new Date(p.dateSolved);
  if (!inRange(dateSolved)) return `Problem at row ${row} has invalid dateSolved`;
  const nextRevisionAt = new Date(p.nextRevisionAt);
  if (!inRange(nextRevisionAt)) return `Problem at row ${row} has invalid nextRevisionAt`;

  const tags = stringsIn(p.tags);
  const lists = stringsIn(p.lists);
  const defaulted = stringsIn(p.defaulted);
  return {
    key: `${p.platform}:${p.problemNumber}`,
    platform: p.platform,
    problemNumber: p.problemNumber,
    title,
    url: trimTo(p.url, 2000) || '#',
    difficulty: p.difficulty,
    topic: trimTo(p.topic, 100) || 'General',
    dateSolved: dateSolved.toISOString(),
    notes: trimTo(p.notes, 20000) || null,
    customFields: readCustomFields(p.customFields),
    code: trimTo(p.code, 40) || null,
    tags: tags ? parseList(tags.join(';')) : undefined,
    lists: lists ? parseList(lists.join(';'), false, MAX_LISTS) : undefined,
    isFavorite: typeof p.isFavorite === 'boolean' ? p.isFavorite : undefined,
    status: VALID_STATUSES.has(p.status) ? p.status : 'ACTIVE',
    currentStep: isInt(p.currentStep, 0, 3) ? p.currentStep : 0,
    nextRevisionAt: nextRevisionAt.toISOString(),
    // Int column: anything past 2^31-1 would fail the transaction.
    revisionCount: isInt(p.revisionCount, 0, 1_000_000) ? p.revisionCount : undefined,
    revisions: cleanRevisions(p.revisions),
    defaulted: defaulted ?? undefined,
  };
}

/**
 * Column definitions to ensure: typed ones from a backup, plain names (text),
 * then any key used in customFields. Case-insensitive, first one wins.
 */
function collectColumnDefs(body: any, rows: Row[]): ImportColumnDef[] {
  const defs: ImportColumnDef[] = [];
  const seen = new Set<string>();
  const add = (name: unknown, type: unknown = 'text', options: unknown = []) => {
    const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!n || n.length > MAX_COLUMN_NAME || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    const opts = normalizeOptions(options);
    defs.push({ name: n, type: isColumnType(type) ? type : 'text', options: opts.ok ? opts.value : [] });
  };
  if (Array.isArray(body.columnDefs)) for (const c of body.columnDefs) add(c?.name, c?.type, c?.options);
  if (Array.isArray(body.customColumns)) for (const c of body.customColumns) add(c);
  for (const r of rows) for (const k of Object.keys(r.customFields ?? {})) add(k);
  return defs;
}

type StudyEntry = StudyFields & { createdAt?: Date };

/** Valid to-learn items from a backup, in their saved order; invalid ones are dropped. */
function collectStudyItems(input: unknown): StudyEntry[] {
  if (!Array.isArray(input)) return [];
  const sorted = input
    .filter((s) => s && typeof s === 'object' && !Array.isArray(s))
    .slice(0, MAX_STUDY_ITEMS)
    .map((s, i) => ({ s: s as Record<string, unknown>, i }))
    .sort((a, b) => (Number(a.s.order) || 0) - (Number(b.s.order) || 0) || a.i - b.i);
  const out: StudyEntry[] = [];
  for (const { s } of sorted) {
    const parsed = parseStudyInput(s, false);
    if ('error' in parsed) continue;
    const created = new Date(String(s.createdAt ?? ''));
    out.push({ ...parsed.data, createdAt: inRange(created) ? created : undefined });
  }
  return out;
}

const studyKey = (kind: string | undefined, title: string | undefined) => `${kind}:${(title ?? '').trim().toLowerCase()}`;

/** Appends backup items to the to-learn list, skipping ones already there. Returns how many were added. */
async function importStudyItems(tx: Tx, userId: string, items: StudyEntry[]): Promise<number> {
  if (!items.length) return 0;
  const existing = await tx.studyItem.findMany({ where: { userId }, select: { kind: true, title: true, order: true } });
  const seen = new Set(existing.map((e) => studyKey(e.kind, e.title)));
  let order = existing.reduce((max, e) => Math.max(max, e.order + 1), 0);
  const room = Math.max(0, MAX_STUDY_ITEMS - existing.length);

  const data: Prisma.StudyItemCreateManyInput[] = [];
  for (const item of items) {
    if (data.length >= room) break;
    const key = studyKey(item.kind, item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const isDsa = item.kind === 'DSA';
    data.push({
      userId,
      kind: item.kind!,
      title: item.title!,
      url: item.url ?? null,
      platform: isDsa ? (item.platform ?? null) : null,
      identifier: isDsa ? (item.identifier ?? null) : null,
      difficulty: isDsa ? (item.difficulty ?? null) : null,
      topic: item.topic ?? null,
      note: item.note ?? null,
      targetDate: item.targetDate ? dayKeyToDate(item.targetDate) : null,
      order: order++,
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
    });
  }
  if (data.length) await tx.studyItem.createMany({ data });
  return data.length;
}

function collectStreakLogs(input: unknown): StreakEntry[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s) => typeof s?.date === 'string' && isRealDay(s.date)).slice(0, MAX_STREAK_DAYS);
}

// ---------------------------------------------------------------------------
// Transaction steps
// ---------------------------------------------------------------------------

/** Creates missing columns (up to MAX_COLUMNS) and rewrites row values under canonical column names. */
async function importColumns(tx: Tx, userId: string, defs: ImportColumnDef[], rows: Row[]) {
  const existing = await tx.userColumnConfig.findMany({ where: { userId }, orderBy: { order: 'asc' } });
  const byLower = new Map<string, CustomColumn>(existing.map((c) => [c.name.toLowerCase(), toCustomColumn(c)]));
  let nextOrder = existing.reduce((max, c) => Math.max(max, c.order + 1), 0);
  const created: string[] = [];

  for (const def of defs) {
    if (byLower.has(def.name.toLowerCase())) continue;
    if (byLower.size >= MAX_COLUMNS) break;
    const column = await tx.userColumnConfig.create({
      data: {
        userId,
        name: def.name,
        type: def.type,
        options: def.type === 'select' ? def.options : undefined,
        order: nextOrder++,
      },
    });
    byLower.set(def.name.toLowerCase(), toCustomColumn(column));
    created.push(def.name);
  }

  // Values go under the column's own name, normalized for its type when they parse.
  for (const r of rows) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.customFields ?? {})) {
      const col = byLower.get(k.trim().toLowerCase());
      if (!col || !v) continue;
      const parsed = parseCustomValue(col, v);
      const value = parsed.ok ? parsed.value : v.slice(0, 1000);
      if (value) out[col.name] = value;
    }
    r.customFields = out;
  }
  return created;
}

/** Matches list names to existing lists case-insensitively and creates the rest. */
async function importLists(tx: Tx, userId: string, names: string[]) {
  const idByLower = new Map<string, string>();
  const created: string[] = [];
  if (!names.length) return { idByLower, created };

  const existing = await tx.problemList.findMany({ where: { userId }, select: { id: true, name: true } });
  for (const l of existing) idByLower.set(l.name.toLowerCase(), l.id);
  for (const name of names) {
    if (idByLower.has(name.toLowerCase())) continue;
    const list = await tx.problemList.create({ data: { userId, name }, select: { id: true } });
    idByLower.set(name.toLowerCase(), list.id);
    created.push(name);
  }
  return { idByLower, created };
}

function toCreateInput(userId: string, r: Row): Prisma.ProblemCreateManyInput {
  return {
    userId,
    platform: r.platform,
    problemNumber: r.problemNumber,
    code: r.code ?? null,
    title: r.title,
    url: r.url,
    difficulty: r.difficulty,
    topic: r.topic,
    tags: r.tags ?? [],
    dateSolved: new Date(r.dateSolved),
    notes: r.notes,
    customFields: r.customFields ?? {},
    isFavorite: r.isFavorite ?? false,
    status: r.status,
    currentStep: r.currentStep,
    nextRevisionAt: new Date(r.nextRevisionAt),
    revisionCount: r.revisionCount ?? r.revisions?.length ?? 0,
  };
}

/** Revision history from backups. Overwrite replaces it; merge adds the ones not already there. */
async function importRevisions(
  tx: Tx,
  rows: Row[],
  createdKeys: Set<string>,
  idByKey: Map<string, string>,
  strategy: DuplicateStrategy
): Promise<number> {
  const withRevisions = rows.filter((r) => r.revisions?.length && idByKey.has(r.key));
  const duplicateIds = (s: DuplicateStrategy) =>
    strategy === s ? withRevisions.filter((r) => !createdKeys.has(r.key)).map((r) => idByKey.get(r.key)!) : [];

  const overwriteIds = duplicateIds('overwrite');
  if (overwriteIds.length) await tx.revision.deleteMany({ where: { problemId: { in: overwriteIds } } });

  const mergeIds = duplicateIds('merge');
  const kept = mergeIds.length
    ? await tx.revision.findMany({ where: { problemId: { in: mergeIds } }, select: { problemId: true, revisedAt: true } })
    : [];
  const seen = new Set(kept.map((r) => `${r.problemId}:${r.revisedAt.toISOString()}`));

  const data: Prisma.RevisionCreateManyInput[] = [];
  for (const r of withRevisions) {
    const problemId = idByKey.get(r.key)!;
    for (const rev of r.revisions!) {
      const key = `${problemId}:${rev.revisedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ problemId, ...rev, revisedAt: new Date(rev.revisedAt) });
    }
  }
  for (let i = 0; i < data.length; i += REVISION_BATCH) {
    await tx.revision.createMany({ data: data.slice(i, i + REVISION_BATCH) });
  }
  return data.length;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.problems)) return badRequest('Request body must include a "problems" array');
    const studyItems = collectStudyItems(body.studyItems);
    if (body.problems.length === 0 && studyItems.length === 0) return badRequest('No problems provided to import');
    if (body.problems.length > MAX_IMPORT_ROWS) {
      return badRequest(`Maximum ${MAX_IMPORT_ROWS.toLocaleString('en-US')} problems can be imported at once`);
    }
    const strategy: DuplicateStrategy = body.duplicateStrategy ?? 'skip';
    if (!DUPLICATE_STRATEGIES.has(strategy)) return badRequest('duplicateStrategy must be skip, overwrite or merge');

    // Validate everything up front; repeated keys in the file keep the first row.
    const rows: Row[] = [];
    const seenKeys = new Set<string>();
    let inFileDuplicates = 0;
    for (let i = 0; i < body.problems.length; i++) {
      const row = cleanRow(body.problems[i], i + 1);
      if (typeof row === 'string') return badRequest(row);
      if (seenKeys.has(row.key)) {
        inFileDuplicates++;
        continue;
      }
      seenKeys.add(row.key);
      rows.push(row);
    }

    const columnDefs = collectColumnDefs(body, rows);
    const listNames = parseList(rows.flatMap((r) => r.lists ?? []).join(';'), false, MAX_LISTS);
    const streakLogs = collectStreakLogs(body.streakLogs);

    const result = await prisma.$transaction(
      async (tx) => {
        const customColumnsCreated = await importColumns(tx, userId, columnDefs, rows);
        const lists = await importLists(tx, userId, listNames);

        // New vs already tracked.
        const numbers = [...new Set(rows.map((r) => r.problemNumber))];
        const existing = await tx.problem.findMany({
          where: { userId, problemNumber: { in: numbers } },
          select: {
            id: true, platform: true, problemNumber: true, title: true, url: true, difficulty: true, topic: true,
            dateSolved: true, notes: true, code: true, tags: true, customFields: true, isFavorite: true,
            status: true, currentStep: true, nextRevisionAt: true, revisionCount: true,
          },
        });
        const existingByKey = new Map(existing.map((e) => [`${e.platform}:${e.problemNumber}`, e]));
        const toCreate = rows.filter((r) => !existingByKey.has(r.key));
        const duplicates = rows.filter((r) => existingByKey.has(r.key));

        let imported = 0;
        for (let i = 0; i < toCreate.length; i += PROBLEM_BATCH) {
          const data = toCreate.slice(i, i + PROBLEM_BATCH).map((r) => toCreateInput(userId, r));
          imported += (await tx.problem.createMany({ data, skipDuplicates: true })).count;
        }

        let updated = 0;
        let skipped = inFileDuplicates;
        const touched: Row[] = [];
        for (const r of duplicates) {
          if (strategy === 'skip') {
            skipped++;
            continue;
          }
          const current = existingByKey.get(r.key)!;
          const data = buildDuplicateUpdate(current, r, strategy);
          touched.push(r);
          if (Object.keys(data).length === 0) {
            skipped++;
            continue;
          }
          await tx.problem.update({ where: { id: current.id }, data: data as Prisma.ProblemUpdateInput });
          updated++;
        }

        // Ids of everything now tracked, for revisions and list membership.
        const idRows = await tx.problem.findMany({
          where: { userId, problemNumber: { in: numbers } },
          select: { id: true, platform: true, problemNumber: true },
        });
        const idByKey = new Map(idRows.map((p) => [`${p.platform}:${p.problemNumber}`, p.id]));
        const affected = [...toCreate, ...touched];

        const revisionsImported = await importRevisions(
          tx,
          affected,
          new Set(toCreate.map((r) => r.key)),
          idByKey,
          strategy
        );

        // List membership is a union: importing never removes a problem from a list.
        for (const [lower, listId] of lists.idByLower) {
          const ids = affected
            .filter((r) => r.lists?.some((l) => l.toLowerCase() === lower))
            .map((r) => idByKey.get(r.key))
            .filter((id): id is string => !!id);
          if (ids.length) {
            await tx.problemList.update({
              where: { id: listId },
              data: { problems: { connect: ids.map((id) => ({ id })) } },
            });
          }
        }

        let streakDaysImported = 0;
        if (streakLogs.length) {
          const res = await tx.streakLog.createMany({
            data: streakLogs.map((s) => ({
              userId,
              date: new Date(`${s.date}T00:00:00.000Z`),
              completed: s.completed === true,
            })),
            skipDuplicates: true,
          });
          streakDaysImported = res.count;
        }

        const studyItemsImported = await importStudyItems(tx, userId, studyItems);

        return {
          imported,
          updated,
          // createMany's skipDuplicates can drop rows that raced in meanwhile.
          skipped: skipped + (toCreate.length - imported),
          customColumnsCreated,
          listsCreated: lists.created,
          revisionsImported,
          streakDaysImported,
          studyItemsImported,
        };
      },
      { timeout: 60000, maxWait: 10000 }
    );

    return Response.json({ ...result, total: body.problems.length, duplicateStrategy: strategy }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/problems/import]', e);
    return jsonError('Failed to import problems', 500);
  }
}
