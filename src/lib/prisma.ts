// The one Prisma client for the whole app.
//
// Next.js hot reloads re-evaluate modules in development, which would create
// a new client (and connection pool) on every edit. Keeping the instance on
// globalThis outside production means exactly one pool per process.
// Runtime queries use DATABASE_URL (Neon's pooled endpoint); DIRECT_URL is
// only for migrations.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
