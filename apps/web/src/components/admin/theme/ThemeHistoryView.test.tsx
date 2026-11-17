// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { HistoryDto, HistoryRowDto, VersionDetailDto } from '@/lib/data/admin/theme-types';
import { DEFAULT_THEME } from '@ad/theme/client';
import { ToastProvider } from '../Toast';
import { ThemeHistoryView, type HistoryActions } from './ThemeHistoryView';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const row = (version: number, overrides: Partial<HistoryRowDto> = {}): HistoryRowDto => ({
  id: `id-${version}`,
  version,
  status: 'published',
  isCurrent: false,
  isDraftInProgress: false,
  at: '2026-11-04T10:30:00.000Z',
  by: 'Tunde Bakare',
  fontLabel: 'DM Sans',
  typeScale: 1,
  swatches: Object.values(DEFAULT_THEME.colors),
  primary: '#2B7A4B',
  contrast: 5.27,
  contrastLevel: 'pass',
  ...overrides,
});

const data = (items: HistoryRowDto[], extra: Partial<HistoryDto> = {}): HistoryDto => ({
  items,
  total: items.length,
  nextBefore: null,
  ...extra,
});

function setup(initial: HistoryDto, overrides: Partial<HistoryActions> = {}) {
  const actions: HistoryActions = {
    load: vi.fn(async () => ({ ok: true as const, data: data([row(11, { status: 'draft' })]) })),
    loadVersion: vi.fn(async (id: string) => ({
      ok: true as const,
      data: { ...row(Number(id.split('-')[1])), theme: DEFAULT_THEME } as VersionDetailDto,
    })),
    restore: vi.fn(async () => ({ ok: true as const, data: { version: 15 } })),
    ...overrides,
  };
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ThemeHistoryView initial={initial} actions={actions} />
    </ToastProvider>,
  );
  return { actions, user };
}

const items = [
  row(14, { isCurrent: true, by: 'Adaeze Okafor' }),
  row(13),
  row(12),
  row(11, { status: 'draft' }),
];

describe('ThemeHistoryView', () => {
  it('lists versions newest first with status words and a swatch strip', () => {
    setup(data(items, { total: 14 }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getByText('v14')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Current')).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
    expect(within(rows[3]!).getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 14 versions')).toBeInTheDocument();
  });

  it('shows the empty state before anything is saved', () => {
    setup(data([]));
    expect(screen.getByText('No saved versions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to theme settings' })).toHaveAttribute(
      'href',
      '/admin/theme',
    );
  });

  it('filters with the pills and reloads', async () => {
    const { actions, user } = setup(data(items));
    await user.click(screen.getByRole('button', { name: 'Drafts' }));
    expect(actions.load).toHaveBeenCalledWith({ filter: 'draft', beforeVersion: undefined });
    expect(await screen.findByText('v11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('loads older versions and appends them', async () => {
    const { actions, user } = setup(data(items, { total: 6, nextBefore: 11 }), {
      load: vi.fn(async () => ({ ok: true as const, data: data([row(10), row(9)], { total: 6 }) })),
    });
    await user.click(screen.getByRole('button', { name: 'Load older versions' }));
    expect(actions.load).toHaveBeenCalledWith({ filter: 'all', beforeVersion: 11 });
    expect(await screen.findByText('v9')).toBeInTheDocument();
    expect(screen.getByText('v14')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older versions' })).not.toBeInTheDocument();
  });

  it('confirms before restoring, names the version, and goes to the editor', async () => {
    const { actions, user } = setup(data(items));
    await user.click(screen.getByRole('button', { name: 'Restore version 12' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Restore version v12?' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/replaces the draft you have now/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Viewers keep seeing v14 until you publish/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Restore as draft' }));
    await waitFor(() => expect(actions.restore).toHaveBeenCalledWith('id-12'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/theme'));
    expect(
      await screen.findByText(/Version v12 copied into your draft|v12 copied into your draft/),
    ).toBeInTheDocument();
  });

  it('does not restore when the confirm is cancelled', async () => {
    const { actions, user } = setup(data(items));
    await user.click(screen.getByRole('button', { name: 'Restore version 13' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(actions.restore).not.toHaveBeenCalled();
  });

  it('opens a detail view with the colours, font and contrast', async () => {
    const { user } = setup(data(items));
    await user.click(screen.getByRole('button', { name: 'View version 12' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Version v12' })).toBeInTheDocument();
    expect(within(dialog).getByText('#2B7A4B')).toBeInTheDocument();
    expect(within(dialog).getByText('5.27:1 Pass')).toBeInTheDocument();
    expect(within(dialog).getByText(/Restoring creates a new draft/)).toBeInTheDocument();
  });

  it('shows an error with a retry when loading fails', async () => {
    const { user } = setup(data(items), {
      load: vi.fn(async () => ({
        ok: false as const,
        message: 'Something went wrong on our side.',
      })),
    });
    await user.click(screen.getByRole('button', { name: 'Published' }));
    expect(await screen.findByText('Something went wrong on our side.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
