// POST /api/leetcode/lookup — live fallback for problems missing from the local dataset.
// Body: { titleSlug?: string; query?: string }
// Returns { problemNumber?, title, difficulty, topic, url } or { error, reason }.
// Queries LeetCode's public GraphQL API server-side (by slug first, then by search).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';
const TIMEOUT_MS = 6000;

const SLUG_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      topicTags { name }
      isPaidOnly
    }
  }
`;

const SEARCH_QUERY = `
  query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      total: totalNum
      questions: data {
        frontendQuestionId: questionFrontendId
        title
        titleSlug
        difficulty
        topicTags { name }
        isPaidOnly
      }
    }
  }
`;

type LeetCodeQuestion = {
  questionFrontendId?: string;
  frontendQuestionId?: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags?: { name: string }[];
  isPaidOnly?: boolean;
};

type GraphQLResponse = {
  data?: {
    question?: LeetCodeQuestion | null;
    problemsetQuestionList?: { questions?: LeetCodeQuestion[] } | null;
  };
};

async function graphql(query: string, variables: Record<string, unknown>): Promise<GraphQLResponse | null> {
  const res = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function bySlug(titleSlug: string): Promise<LeetCodeQuestion | null> {
  const json = await graphql(SLUG_QUERY, { titleSlug });
  return json?.data?.question ?? null;
}

async function bySearch(query: string): Promise<LeetCodeQuestion | null> {
  const json = await graphql(SEARCH_QUERY, { categorySlug: '', limit: 5, skip: 0, filters: { searchKeywords: query } });
  const list: LeetCodeQuestion[] = json?.data?.problemsetQuestionList?.questions ?? [];
  // A numeric query should match the problem number exactly when that problem is in the results.
  const exact = /^\d+$/.test(query) ? list.find((q) => q.frontendQuestionId === query) : undefined;
  return exact ?? list[0] ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const titleSlug = typeof body?.titleSlug === 'string' ? body.titleSlug.trim() : '';
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!titleSlug && !query) {
      return NextResponse.json({ error: 'titleSlug or query required' }, { status: 400 });
    }

    let question = titleSlug ? await bySlug(titleSlug) : null;
    if (!question && query) question = await bySearch(query);

    if (!question || question.isPaidOnly) {
      return NextResponse.json({ error: 'Problem not found or is premium', reason: 'not_found' }, { status: 404 });
    }

    const problemNumber = parseInt(question.questionFrontendId ?? question.frontendQuestionId ?? '', 10);
    return NextResponse.json({
      problemNumber: Number.isNaN(problemNumber) ? undefined : problemNumber,
      title: question.title,
      difficulty: question.difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
      topic: question.topicTags?.[0]?.name ?? 'General',
      url: `https://leetcode.com/problems/${question.titleSlug}/`,
    });
  } catch (e) {
    console.warn('[POST /api/leetcode/lookup]', e);
    return NextResponse.json({ error: 'Failed to fetch from LeetCode', reason: 'lookup_failed' }, { status: 502 });
  }
}
