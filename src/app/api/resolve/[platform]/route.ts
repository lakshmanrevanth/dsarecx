// GET /api/resolve/[platform]?id=<identifier> — resolve problem metadata on any supported platform.
// Not found → 200 { found: false, reason }; source unreachable → 502 { found: false, reason: 'lookup_failed' }.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getResolver } from '@/lib/platforms';

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { platform: rawPlatform } = await params;
  const resolver = getResolver(rawPlatform.toUpperCase());
  if (!resolver) {
    return Response.json(
      { error: `Unsupported platform: ${rawPlatform}. Supported platforms: LEETCODE, CODEFORCES, CODECHEF, GFG, HACKERRANK` },
      { status: 400 }
    );
  }

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return Response.json({ error: 'id query param required' }, { status: 400 });

    const result = await resolver.resolve(id);
    if (result.found) return Response.json(result);

    // 502 lets the client tell "source unreachable" apart from "no such problem".
    const reason = result.reason ?? 'not_found';
    return Response.json({ found: false, reason }, { status: reason === 'lookup_failed' ? 502 : 200 });
  } catch (e) {
    console.error(`[GET /api/resolve/${rawPlatform}]`, e);
    return Response.json({ found: false, reason: 'lookup_failed', error: 'Resolver failed' }, { status: 500 });
  }
}
