// GET    /api/account — the sign-in methods shown in Settings → Account
// DELETE /api/account — permanently delete the account. Body: { confirmEmail }

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { emailChangePrefix, json, readJson } from './shared';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, password: true, accounts: { select: { provider: true } } },
    });
    if (!user) return json({ error: 'User not found' }, 404);

    return json({
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      hasPassword: Boolean(user.password),
      providers: Array.from(new Set(user.accounts.map((a) => a.provider))),
    });
  } catch (e) {
    console.error('[GET /api/account]', e);
    return json({ error: 'Failed to load account' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return json({ error: 'User not found' }, 404);

    const email = user.email.toLowerCase();
    const typed = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
    if (typed !== email) return json({ error: 'Type your email address exactly to confirm' }, 400);

    const changePrefix = emailChangePrefix(userId);
    // StreakLog, UserColumnConfig and VerificationToken aren't related to User in the schema,
    // so they're removed explicitly. Problems, revisions, lists, accounts and sessions cascade.
    await prisma.$transaction([
      prisma.streakLog.deleteMany({ where: { userId } }),
      prisma.userColumnConfig.deleteMany({ where: { userId } }),
      prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { in: [email, `reset:${email}`, `fail:${email}`, `fail:reset:${email}`] } },
            { identifier: { startsWith: changePrefix } },
            { identifier: { startsWith: `fail:${changePrefix}` } },
          ],
        },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/account]', e);
    return json({ error: 'Failed to delete account' }, 500);
  }
}
