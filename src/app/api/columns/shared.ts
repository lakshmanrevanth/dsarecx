// Column mutations shared by /api/columns and /api/columns/[id].
// Both run in one transaction because they also rewrite every problem's customFields.

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  distinctValues,
  isColumnType,
  normalizeOptions,
  readCustomFields,
  removeFieldKey,
  renameFieldKey,
  reorderIds,
  toCustomColumn,
  validateColumnName,
  type ColumnType,
} from '@/lib/custom-columns';

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 30000, maxWait: 10000 };
const TYPE_ERROR = 'Type must be one of text, select, date, checkbox, url';

/** Duplicate names are a conflict; every other name problem is a bad request. */
const nameErrorStatus = (error: string) => (error.includes('already exists') ? 409 : 400);

/**
 * Applies `transform` to every problem's customFields and saves the ones it changes
 * (transform returns null for "unchanged"). Returns how many problems changed.
 */
async function rewriteCustomFields(
  tx: Tx,
  userId: string,
  transform: (fields: Record<string, string>) => Record<string, string> | null
): Promise<number> {
  const problems = await tx.problem.findMany({ where: { userId }, select: { id: true, customFields: true } });
  let changed = 0;
  for (const p of problems) {
    const next = transform(readCustomFields(p.customFields));
    if (!next) continue;
    await tx.problem.update({ where: { id: p.id }, data: { customFields: next } });
    changed++;
  }
  return changed;
}

/** Deletes a column and drops its value from every problem, so a later column with the same name starts empty. */
export async function deleteColumn(userId: string, id: string): Promise<Response> {
  const result = await prisma.$transaction(async (tx) => {
    const column = await tx.userColumnConfig.findFirst({ where: { id, userId } });
    if (!column) return null;
    const cleared = await rewriteCustomFields(tx, userId, (fields) => removeFieldKey(fields, column.name));
    await tx.userColumnConfig.delete({ where: { id } });
    return { cleared };
  }, TX_OPTIONS);

  if (!result) return Response.json({ error: 'Column not found' }, { status: 404 });
  return Response.json({ success: true, cleared: result.cleared });
}

type UpdateOutcome =
  | { error: string; status: number }
  | { column: ReturnType<typeof toCustomColumn>; renamed: number };

/**
 * PATCH { name?, type?, options?, order? }. A rename moves the key in every problem's
 * customFields; switching to select without options seeds them from entered values;
 * a new order renumbers all columns 0..n-1.
 */
export async function updateColumn(userId: string, id: string, body: Record<string, unknown>): Promise<Response> {
  if ('type' in body && !isColumnType(body.type)) return Response.json({ error: TYPE_ERROR }, { status: 400 });
  if ('order' in body && !(typeof body.order === 'number' && Number.isInteger(body.order) && body.order >= 0)) {
    return Response.json({ error: 'order must be a non-negative whole number' }, { status: 400 });
  }
  let options: string[] | undefined;
  if ('options' in body) {
    const parsed = normalizeOptions(body.options);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    options = parsed.value;
  }

  const outcome = await prisma.$transaction(async (tx): Promise<UpdateOutcome> => {
    const all = await tx.userColumnConfig.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const current = all.find((c) => c.id === id);
    if (!current) return { error: 'Column not found', status: 404 };

    const data: { name?: string; type?: ColumnType; options?: string[] } = {};
    let renamed = 0;

    if ('name' in body) {
      const name = validateColumnName(body.name, all, id);
      if (!name.ok) return { error: name.error, status: nameErrorStatus(name.error) };
      if (name.value !== current.name) {
        data.name = name.value;
        renamed = await rewriteCustomFields(tx, userId, (fields) => renameFieldKey(fields, current.name, name.value));
      }
    }

    const nextType = (body.type as ColumnType | undefined) ?? (isColumnType(current.type) ? current.type : 'text');
    if (body.type !== undefined) data.type = nextType;
    if (options !== undefined) data.options = options;

    // Switching to select without options: seed them from the values already entered.
    const becomesSelect = nextType === 'select' && current.type !== 'select';
    if (becomesSelect && options === undefined && toCustomColumn(current).options.length === 0) {
      const key = data.name ?? current.name;
      const problems = await tx.problem.findMany({ where: { userId }, select: { customFields: true } });
      data.options = distinctValues(problems.map((p) => readCustomFields(p.customFields)[key] ?? ''));
    }

    if (typeof body.order === 'number') {
      const ordered = reorderIds(all.map((c) => c.id), id, body.order);
      for (const [index, columnId] of ordered.entries()) {
        const col = all.find((c) => c.id === columnId)!;
        if (col.order !== index) await tx.userColumnConfig.update({ where: { id: col.id }, data: { order: index } });
      }
    }

    const updated = Object.keys(data).length
      ? await tx.userColumnConfig.update({ where: { id }, data })
      : await tx.userColumnConfig.findFirst({ where: { id } });
    return { column: toCustomColumn(updated ?? current), renamed };
  }, TX_OPTIONS);

  if ('error' in outcome) return Response.json({ error: outcome.error }, { status: outcome.status });
  return Response.json({ ...outcome.column, renamed: outcome.renamed });
}
