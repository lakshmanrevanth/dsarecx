// GET  /api/export?format=json|csv&ids=a,b,c
//   json (default): versioned full backup (v2) that the import modal restores,
//                   including the to-learn list (full exports only)
//   csv: every user-facing field plus custom columns, formula-injection safe
//   ids: optional comma-separated problem ids to export only those rows
// POST /api/export { format, ids: string[] } — the same, for selections too long for a URL

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/config/site';
import { toStudyDto } from '@/lib/study';
import { buildBackup, buildCsv } from './format';

const MAX_IDS = 5000;

type Format = 'json' | 'csv';
type ExportRequest = { format: Format; ids: string[] | null };

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

function parseRequest(format: unknown, ids: unknown[] | null): ExportRequest | Response {
  const f = typeof format === 'string' ? format.toLowerCase() : 'json';
  if (f !== 'json' && f !== 'csv') return badRequest('format must be json or csv');
  if (ids === null) return { format: f, ids: null };

  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return badRequest('ids is empty');
  if (unique.length > MAX_IDS) return badRequest(`At most ${MAX_IDS} ids can be exported at once`);
  return { format: f, ids: unique };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const ids = params.get('ids');
    const parsed = parseRequest(params.get('format') ?? 'json', ids === null ? null : ids.split(','));
    if (parsed instanceof Response) return parsed;
    return await exportData(userId, parsed);
  } catch (e) {
    console.error('[GET /api/export]', e);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid request body');
    if (body.ids !== undefined && !Array.isArray(body.ids)) return badRequest('ids must be an array');

    const parsed = parseRequest(body.format ?? 'json', body.ids ?? null);
    if (parsed instanceof Response) return parsed;
    return await exportData(userId, parsed);
  } catch (e) {
    console.error('[POST /api/export]', e);
    return Response.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function download(body: string, contentType: string, filename: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function exportData(userId: string, { format, ids }: ExportRequest): Promise<Response> {
  const [problems, columns] = await Promise.all([
    prisma.problem.findMany({
      where: { userId, ...(ids ? { id: { in: ids } } : {}) },
      include: { revisions: { orderBy: { revisedAt: 'asc' } }, lists: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userColumnConfig.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = ids ? '_selection' : '';
  const prefix = siteConfig.name;

  if (format === 'csv') {
    return download(buildCsv(problems, columns), 'text/csv; charset=utf-8', `${prefix}_problems${suffix}_${stamp}.csv`);
  }

  const [user, lists, streakLogs, studyRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        timezone: true,
        dailyGoal: true,
        defaultPlatform: true,
        ladderDays: true,
        goalBasedStreak: true,
      },
    }),
    prisma.problemList.findMany({ where: { userId }, select: { name: true }, orderBy: { createdAt: 'asc' } }),
    // A partial export carries no streak history: restoring it would overwrite the real one.
    ids ? Promise.resolve([]) : prisma.streakLog.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    // The to-learn list isn't tied to problems, so only a full export carries it.
    ids ? Promise.resolve([]) : prisma.studyItem.findMany({ where: { userId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
  ]);

  // A partial export only includes the lists its problems belong to.
  const exportedLists = ids
    ? lists.filter((list) => problems.some((p) => p.lists.some((pl) => pl.name === list.name)))
    : lists;

  const backup = buildBackup({
    user: user ? { name: user.name, email: user.email } : null,
    preferences: user
      ? {
          timezone: user.timezone,
          dailyGoal: user.dailyGoal,
          defaultPlatform: user.defaultPlatform,
          ladderDays: user.ladderDays,
          goalBasedStreak: user.goalBasedStreak,
        }
      : {},
    columns,
    lists: exportedLists,
    problems,
    streakLogs,
    studyItems: studyRows.map(toStudyDto),
    partial: Boolean(ids),
  });

  return download(JSON.stringify(backup, null, 2), 'application/json', `${prefix}_backup${suffix}_${stamp}.json`);
}
