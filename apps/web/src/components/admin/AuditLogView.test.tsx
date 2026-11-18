// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { auditService } from '@/lib/data/admin/services';
import { getStore } from '@/lib/data/admin/store';
import { AuditLogView } from './AuditLogView';

afterEach(cleanup);
const rows = structuredClone(getStore().audit);

describe('AuditLogView by role', () => {
  it('tells an admin the log is limited to content actions and hides Export', () => {
    render(
      <AuditLogView
        rows={rows}
        nextCursor={null}
        query={{}}
        selected={null}
        restricted
        canExport={false}
      />,
    );
    expect(screen.getByText(/content actions only/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Export CSV' })).toBeNull();
  });
  it('shows the full log with Export to a Super admin', () => {
    render(<AuditLogView rows={rows} nextCursor={null} query={{}} selected={null} />);
    expect(screen.queryByText(/content actions only/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Export CSV' })).toBeTruthy();
  });
});

describe('AuditLogView', () => {
  it('lists entries with the result in words', () => {
    render(<AuditLogView rows={rows} nextCursor={null} query={{}} selected={null} />);
    expect(screen.getByRole('table', { name: /Audit log/ })).toBeTruthy();
    expect(
      within(screen.getByRole('table', { name: /Audit log/ })).getByText('Failed'),
    ).toBeTruthy();
  });
  it('shows an empty state with a next step when filtered', () => {
    render(<AuditLogView rows={[]} nextCursor={null} query={{ action: 'nope' }} selected={null} />);
    expect(screen.getByText('No entries match.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Clear' }).getAttribute('href')).toBe(
      '/admin/audit-log',
    );
  });
  it('shows before and after values in the detail panel', () => {
    const selected = rows.find((r) => r.after)!;
    render(
      <AuditLogView
        rows={rows}
        nextCursor={null}
        query={{ entry: String(selected.id) }}
        selected={selected}
      />,
    );
    expect(screen.getByRole('complementary', { name: `Entry ${selected.id}` })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Values before and after' })).toBeTruthy();
  });
  it('keeps filters in the export link and drops the cursor', () => {
    render(
      <AuditLogView
        rows={rows}
        nextCursor="9"
        query={{ outcome: 'failure', cursor: '5' }}
        selected={null}
      />,
    );
    expect(screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href')).toBe(
      '/admin/audit-log/export?outcome=failure',
    );
  });
});

describe('auditService', () => {
  it('is for admins only', async () => {
    await expect(
      auditService.list({ accountId: 'x', role: 'editor', name: 'E' }, {}),
    ).rejects.toThrow();
    const page = await auditService.list(
      { accountId: 'x', role: 'admin', name: 'A' },
      { outcome: 'failure' },
    );
    expect(page.items.every((r) => r.outcome === 'failure')).toBe(true);
  });
});
