import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { analyticsService, auditService } = await import('./services');
const { INLINE_EXPORT_MAX } = await import('./exports-rules');

const superAdmin = { accountId: 'a1', name: 'A', role: 'super_admin' } as const;
const admin = { accountId: 'a2', name: 'B', role: 'admin' } as const;
const editor = { accountId: 'a3', name: 'C', role: 'editor' } as const;

describe('export plans in fixture mode', () => {
  beforeEach(() => undefined);

  it('counts the audit rows a Super admin would export, and refuses anyone else', async () => {
    const plan = await auditService.exportPlan(superAdmin, {});
    expect(plan.rows).toBeGreaterThan(0);
    expect(plan.rows).toBeLessThanOrEqual(INLINE_EXPORT_MAX);
    await expect(auditService.exportPlan(admin, {})).rejects.toThrow();
    await expect(auditService.exportPlan(editor, {})).rejects.toThrow();
  });

  it('counts fewer rows when the filters are narrower', async () => {
    const all = await auditService.exportPlan(superAdmin, {});
    const some = await auditService.exportPlan(superAdmin, { action: 'no.such.action' });
    expect(some.rows).toBe(0);
    expect(all.rows).toBeGreaterThan(some.rows);
  });

  it('counts analytics rows for an editor, and refuses a viewer', async () => {
    const plan = await analyticsService.exportPlan(editor, {
      from: '2026-11-01',
      to: '2026-11-10',
    });
    expect(plan.rows).toBeGreaterThanOrEqual(0);
    await expect(
      analyticsService.exportPlan(
        { accountId: 'v', name: 'V', role: 'viewer' },
        { from: '2026-11-01', to: '2026-11-10' },
      ),
    ).rejects.toThrow();
  });
});
