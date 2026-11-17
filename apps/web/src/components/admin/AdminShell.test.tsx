// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/videos' }));
vi.mock('./UploaderContext', () => ({
  useUploaderState: () => ({ lanes: [], online: true, uploader: {} }),
  summarizeUploads: () => ({ count: 0, percent: 0 }),
}));

const { AdminShell } = await import('./AdminShell');

const base = {
  platformName: 'Test TV',
  counts: { encoding: 2, captions: 0 },
  signOut: async () => {},
};

describe('AdminShell', () => {
  it('shows an editor only what the role can open and marks the current page', () => {
    render(
      <AdminShell
        {...base}
        actor={{ name: 'Ngozi Eze', role: 'editor', roleLabel: 'Content editor' }}
      >
        x
      </AdminShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(nav).toHaveTextContent('Videos');
    expect(nav).not.toHaveTextContent('Audit log');
    expect(screen.getByRole('link', { name: 'Videos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows admins the control pages', () => {
    render(
      <AdminShell {...base} actor={{ name: 'Chiamaka Okafor', role: 'admin', roleLabel: 'Admin' }}>
        x
      </AdminShell>,
    );
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
  });

  it('opens and closes the drawer from the menu button', async () => {
    render(
      <AdminShell {...base} actor={{ name: 'A B', role: 'admin', roleLabel: 'Admin' }}>
        x
      </AdminShell>,
    );
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
