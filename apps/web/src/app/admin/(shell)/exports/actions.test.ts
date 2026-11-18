import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: null as null | ((a: unknown, r: unknown) => Promise<unknown>),
  received: null as unknown,
  budgetError: null as unknown,
}));

vi.mock('@/lib/data/admin/session-next', () => ({
  requireActionActor: async () => ({ accountId: 'a', role: 'super_admin', name: 'A' }),
  spendAdminBudget: async () => {
    if (state.budgetError) throw state.budgetError;
  },
}));
vi.mock('@/lib/data/admin/exports', () => ({
  exportsAdmin: {
    request: (a: unknown, r: unknown) => {
      state.received = r;
      return state.request!(a, r);
    },
  },
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
}));

import { Conflict, RateLimited, ValidationFailed } from '@ad/shared';
import { requestExportAction } from './actions';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const go = async (fields: Record<string, string>) => {
  try {
    await requestExportAction(form(fields));
  } catch (error) {
    return (error as { to?: string }).to ?? 'threw';
  }
  return 'returned';
};

beforeEach(() => {
  state.request = async () => ({ id: 'x' });
  state.received = null;
  state.budgetError = null;
});

describe('requestExportAction', () => {
  it('starts the export with only the filters it knows, then shows the list', async () => {
    expect(
      await go({
        kind: 'audit',
        action: 'video.',
        from: '2026-06-01',
        scope: 'all',
        junk: 'x',
        cursor: '4',
      }),
    ).toBe('/admin/exports?notice=asked');
    expect(state.received).toEqual({
      kind: 'audit',
      params: { action: 'video.', from: '2026-06-01' },
    });
  });

  it('turns a kind it does not know into a plain error and starts nothing', async () => {
    expect(await go({ kind: 'users' })).toBe('/admin/exports?notice=invalid');
    expect(state.received).toBeNull();
  });

  it('says so when too many are waiting', async () => {
    state.request = async () => {
      throw new Conflict('You already have 3 exports waiting. Wait for one to finish.');
    };
    expect(await go({ kind: 'audit' })).toBe('/admin/exports?notice=busy');
  });

  it('reports rejected filters as invalid and anything else as a failure, with no detail in the link', async () => {
    state.request = async () => {
      throw new ValidationFailed({ range: ['Choose a valid range of dates.'] });
    };
    expect(await go({ kind: 'analytics', from: 'x', to: 'y' })).toBe(
      '/admin/exports?notice=invalid',
    );
    state.request = async () => {
      throw new Error('queue down at 10.0.0.4');
    };
    expect(await go({ kind: 'audit' })).toBe('/admin/exports?notice=failed');
  });

  it('treats a spent request budget as busy', async () => {
    state.budgetError = new RateLimited(30);
    expect(await go({ kind: 'audit' })).toBe('/admin/exports?notice=busy');
    expect(state.received).toBeNull();
  });
});
