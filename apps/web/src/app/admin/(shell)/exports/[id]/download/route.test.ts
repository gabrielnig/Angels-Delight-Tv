import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ actor: null as unknown, budgetError: null as unknown }));
const exportsApi = vi.hoisted(() => ({
  open: null as null | ((a: unknown, id: string) => Promise<unknown>),
}));

vi.mock('@/lib/data/admin/session-next', () => ({
  getActor: async () => session.actor,
  spendAdminBudget: async () => {
    if (session.budgetError) throw session.budgetError;
  },
}));
vi.mock('@/lib/data/admin/exports', () => ({
  exportsAdmin: { open: (a: unknown, id: string) => exportsApi.open!(a, id) },
}));

import { Conflict, Forbidden, NotFound, RateLimited } from '@ad/shared';
import { GET } from './route';

const id = '0192f0a0-0000-7000-8000-000000000001';
const call = () =>
  GET(new Request(`https://tv.test/admin/exports/${id}/download`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  session.actor = { accountId: 'a', role: 'super_admin', name: 'A' };
  session.budgetError = null;
  exportsApi.open = async () => ({
    stream: Readable.from([Buffer.from('id\n1\n')]),
    fileName: 'audit-log-2026-06-10.csv',
    bytes: 5,
  });
});

describe('export download route', () => {
  it('needs a signed in person', async () => {
    session.actor = null;
    expect((await call()).status).toBe(401);
  });

  it('streams the file as a private download that no cache or sniffer keeps', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('id\n1\n');
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="audit-log-2026-06-10.csv"',
    );
    expect(response.headers.get('content-length')).toBe('5');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('answers 404 for a file owned by someone else and for a missing or expired one, with no detail about which', async () => {
    exportsApi.open = async () => {
      throw new NotFound('Export not found');
    };
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('This file is not available.');
  });

  it('answers 403 when the permission is gone, and 409 while it is not ready', async () => {
    exportsApi.open = async () => {
      throw new Forbidden();
    };
    expect((await call()).status).toBe(403);
    exportsApi.open = async () => {
      throw new Conflict('This export is not ready yet.');
    };
    const response = await call();
    expect(response.status).toBe(409);
    expect(await response.text()).toBe('This export is not ready yet.');
  });

  it('answers 429 with retry-after when the budget is spent', async () => {
    session.budgetError = new RateLimited(20);
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('20');
  });
});
