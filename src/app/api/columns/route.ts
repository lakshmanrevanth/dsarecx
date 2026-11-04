// GET    /api/columns         — the user's custom columns, in order
// POST   /api/columns         — create { name, type?, options?, order? }
// DELETE /api/columns?id=...  — legacy alias of DELETE /api/columns/[id]

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  MAX_COLUMNS,
  isColumnType,
  normalizeOptions,
  toCustomColumn,
  validateColumnName,
} from '@/lib/custom-columns';
import { NO_STORE_HEADERS, badRequest, currentUserId, jsonError, unauthorized } from '../_shared/http';
import { deleteColumn } from './shared';

const MAX_ORDER = 10_000;

export async function GET(_request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const columns = await prisma.userColumnConfig.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return Response.json(columns.map(toCustomColumn), { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('[GET /api/columns]', e);
    return jsonError('Failed to fetch columns', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid request body');

    const type = body.type ?? 'text';
    if (!isColumnType(type)) return badRequest('Type must be one of text, select, date, checkbox, url');
    const options = normalizeOptions(body.options);
    if (!options.ok) return badRequest(options.error);

    const existing = await prisma.userColumnConfig.findMany({
      where: { userId },
      select: { id: true, name: true, order: true },
    });
    if (existing.length >= MAX_COLUMNS) return badRequest(`You can have at most ${MAX_COLUMNS} custom columns`);

    const name = validateColumnName(body.name, existing);
    if (!name.ok) return jsonError(name.error, name.error.includes('already exists') ? 409 : 400);

    const appendOrder = existing.reduce((max, c) => Math.max(max, c.order + 1), 0);
    const order = Number.isInteger(body.order) && body.order >= 0 && body.order <= MAX_ORDER ? body.order : appendOrder;

    const column = await prisma.userColumnConfig.create({
      data: {
        userId,
        name: name.value,
        type,
        options: type === 'select' ? options.value : undefined,
        order,
      },
    });
    return Response.json(toCustomColumn(column), { status: 201 });
  } catch (e) {
    console.error('[POST /api/columns]', e);
    return jsonError('Failed to create column', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return badRequest('Column id is required');
    return await deleteColumn(userId, id);
  } catch (e) {
    console.error('[DELETE /api/columns]', e);
    return jsonError('Failed to delete column', 500);
  }
}
