import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const admin = { accountId: 'acc_admin', role: 'admin' as const, name: 'Chiamaka Okafor' };

beforeEach(() => {
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('ad.theme.runtime')];
  delete process.env.KB_DEMO;
});

describe('demo theme history', () => {
  it('starts empty on a plain fixture runtime', async () => {
    const { themeAdmin } = await import('../theme');
    const result = await themeAdmin.history(admin, {});
    expect(result.ok && result.data.total).toBe(0);
  });

  it('holds two published versions when the demo layer is on', async () => {
    process.env.KB_DEMO = 'on';
    const { themeAdmin } = await import('../theme');
    const result = await themeAdmin.history(admin, { filter: 'published' });
    expect(result.ok && result.data.total).toBe(2);
    if (result.ok) expect(result.data.items.map((i) => i.version).sort()).toEqual([1, 2]);
  });
});
