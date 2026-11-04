// PATCH  /api/columns/[id] — { name?, type?, options?, order? }; a rename also moves the key in every problem
// DELETE /api/columns/[id] — delete the column and its values on every problem

import type { NextRequest } from 'next/server';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../_shared/http';
import { deleteColumn, updateColumn } from '../shared';

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Invalid request body');
    return await updateColumn(userId, id, body);
  } catch (e) {
    console.error('[PATCH /api/columns/[id]]', e);
    return jsonError('Failed to update column', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;
    return await deleteColumn(userId, id);
  } catch (e) {
    console.error('[DELETE /api/columns/[id]]', e);
    return jsonError('Failed to delete column', 500);
  }
}
