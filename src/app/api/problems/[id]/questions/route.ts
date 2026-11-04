// POST /api/problems/[id]/questions — generate recall questions with Claude and save them
// PUT  /api/problems/[id]/questions — save questions edited by the user: { questions: string[] }

import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import {
  AiOutputError,
  AiRefusalError,
  MAX_QUESTIONS,
  generateRecallQuestions,
  isAiConfigured,
  normalizeQuestions,
} from '@/lib/ai/recall-questions';
import { getPathArticle } from '@/lib/concepts/paths';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

const HOUR_MS = 60 * 60 * 1000;
/** Each generation is a paid API call, so it is capped per user. */
const GENERATIONS_PER_HOUR = 30;
const PATH_CODE_PREFIX = 'path:';

export async function POST(_request: NextRequest, { params }: IdContext) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;

  if (!isAiConfigured()) {
    return jsonError('AI questions are not set up on this server.', 503, { code: 'AI_NOT_CONFIGURED' });
  }

  const problem = await prisma.problem.findFirst({
    where: { id, userId },
    select: { id: true, title: true, topic: true, difficulty: true, platform: true, notes: true, url: true, code: true },
  });
  if (!problem) return jsonError('Problem not found', 404);

  const limit = await rateLimit(`ai-questions:${userId}`, GENERATIONS_PER_HOUR, HOUR_MS);
  if (!limit.ok) {
    return jsonError(
      `You've generated a lot of questions recently. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`,
      429,
      undefined,
      { 'Retry-After': String(limit.retryAfterSec) }
    );
  }

  // Learning-path articles carry a one-line summary that helps the model.
  const pathEntry = problem.code?.startsWith(PATH_CODE_PREFIX)
    ? getPathArticle(problem.code.slice(PATH_CODE_PREFIX.length))
    : undefined;

  try {
    const questions = await generateRecallQuestions({
      title: problem.title,
      kind: problem.platform === 'SYSTEM_DESIGN' ? 'system-design' : 'coding-problem',
      topic: problem.topic,
      difficulty: problem.difficulty,
      summary: pathEntry?.article.summary ?? null,
      notes: problem.notes,
      url: problem.url || null,
    });
    await prisma.problem.update({ where: { id }, data: { recallQuestions: questions } });
    return Response.json({ questions });
  } catch (e) {
    if (e instanceof AiRefusalError || e instanceof AiOutputError) return jsonError(e.message, 422);
    if (e instanceof Anthropic.RateLimitError) return jsonError('The AI service is busy. Try again in a minute.', 503);
    if (e instanceof Anthropic.APIError) {
      console.error('[POST questions] Anthropic API error', e.status, e.message);
      return jsonError('The AI service failed. Try again later.', 502);
    }
    console.error('[POST /api/problems/[id]/questions]', e);
    return jsonError('Failed to generate questions', 500);
  }
}

export async function PUT(request: NextRequest, { params }: IdContext) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.questions)) return badRequest('questions must be a list');
  // Allow some slack for blanks and duplicates that normalizeQuestions drops.
  if (body.questions.length > MAX_QUESTIONS * 2) return badRequest(`At most ${MAX_QUESTIONS} questions`);
  const questions = normalizeQuestions(body.questions);

  const { count } = await prisma.problem.updateMany({ where: { id, userId }, data: { recallQuestions: questions } });
  if (count === 0) return jsonError('Problem not found', 404);
  return Response.json({ questions });
}
