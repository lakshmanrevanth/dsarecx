// DELETE /api/account/providers/:provider — unlink an OAuth provider (e.g. "github").
// Refused when it would leave the account with no way to sign in.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { json } from '../../shared';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);
    const { provider } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, accounts: { select: { id: true, provider: true } } },
    });
    if (!user) return json({ error: 'User not found' }, 404);

    if (!user.accounts.some((a) => a.provider === provider)) {
      return json({ error: 'That provider is not linked' }, 404);
    }
    const hasOtherProvider = user.accounts.some((a) => a.provider !== provider);
    if (!user.password && !hasOtherProvider) {
      return json({ error: 'Set a password or link another provider before removing your only sign-in method' }, 400);
    }

    await prisma.account.deleteMany({ where: { userId, provider } });
    return json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/account/providers]', e);
    return json({ error: 'Failed to unlink provider' }, 500);
  }
}
