import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => {
  const client: any = { problem: { findFirst: vi.fn(), update: vi.fn() } };
  client.$transaction = vi.fn(async (cb: any) => cb(client));
  return { prisma: client };
});

const db = prisma as any;
const call = (body: unknown) =>
  PATCH(new NextRequest('http://x/api/problems/p1/custom-fields', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'p1' }),
  });

describe('PATCH /api/problems/[id]/custom-fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth as any).mockResolvedValue({ user: { id: 'u1' } });
  });

  it('401 when signed out', async () => {
    vi.mocked(auth as any).mockResolvedValue(null);
    expect((await call({ key: 'a', value: 'b' })).status).toBe(401);
  });

  it('404 for a problem the user does not own', async () => {
    db.problem.findFirst.mockResolvedValue(null);
    expect((await call({ key: 'a', value: 'b' })).status).toBe(404);
    expect(db.problem.findFirst.mock.calls[0][0].where).toEqual({ id: 'p1', userId: 'u1' });
  });

  it('sets one key, or merges an object of values', async () => {
    db.problem.findFirst.mockResolvedValue({ customFields: { Lang: 'Go' } });
    const one = await (await call({ key: 'Company', value: 'Meta' })).json();
    expect(one.customFields).toEqual({ Lang: 'Go', Company: 'Meta' });

    const many = await (await call({ Lang: 'Rust', Done: 'true' })).json();
    expect(many.customFields).toEqual({ Lang: 'Rust', Done: 'true' });
    expect(db.problem.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { customFields: { Lang: 'Rust', Done: 'true' } } });
  });
});
