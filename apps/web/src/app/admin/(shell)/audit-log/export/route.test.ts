import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  actor: null as unknown,
  allowed: true,
  budgetError: null as unknown,
}));
const state = vi.hoisted(() => ({ plan: 3, query: null as unknown, exported: 0 }));

vi.mock('@/lib/data/admin/session-next', () => ({
  getActor: async () => session.actor,
  allowed: () => session.allowed,
  spendAdminBudget: async () => {
    if (session.budgetError) throw session.budgetError;
  },
}));
vi.mock('@/lib/data/admin/services', () => ({
  auditService: {
    exportPlan: async (_a: unknown, query: unknown) => {
      state.query = query;
      return { rows: state.plan };
    },
    exportRows: async () => {
      state.exported += 1;
      return { rows: [], total: state.plan, truncated: false };
    },
  },
}));

import { RateLimited } from '@ad/shared';
import { GET } from './route';

const call = (query = 'action=video.&from=2026-11-01') =>
  GET(new Request(`https://tv.test/admin/audit-log/export?${query}`));

beforeEach(() => {
  session.actor = { accountId: 'a', role: 'super_admin', name: 'A' };
  session.allowed = true;
  session.budgetError = null;
  state.plan = 3;
  state.exported = 0;
});

describe('audit log export route', () => {
  it('needs a signed in Super admin', async () => {
    session.actor = null;
    expect((await call()).status).toBe(401);
    session.actor = { accountId: 'a', role: 'admin', name: 'A' };
    session.allowed = false;
    expect((await call()).status).toBe(403);
    expect(state.exported).toBe(0);
  });

  it('answers 429 with retry-after when the budget is spent', async () => {
    session.budgetError = new RateLimited(12);
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
  });

  it('downloads a small export in the request', async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toMatch(/audit-log-\d{4}-\d{2}-\d{2}\.csv/);
    expect(response.headers.get('x-export-truncated')).toBeNull();
  });

  it('sends a big export to the confirm page with the same filters, and builds nothing', async () => {
    state.plan = 10_001;
    const response = await call();
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location')!, 'https://tv.test');
    expect(location.pathname).toBe('/admin/exports/new');
    expect(location.searchParams.get('kind')).toBe('audit');
    expect(location.searchParams.get('action')).toBe('video.');
    expect(location.searchParams.get('from')).toBe('2026-11-01');
    expect(state.exported).toBe(0);
  });

  it('does not carry a cursor or an open entry into the export', async () => {
    state.plan = 20_000;
    const response = await call('cursor=99&entry=4&action=x.');
    const location = new URL(response.headers.get('location')!, 'https://tv.test');
    expect(location.searchParams.get('cursor')).toBeNull();
    expect(location.searchParams.get('entry')).toBeNull();
    expect(location.searchParams.get('action')).toBe('x.');
  });
});
