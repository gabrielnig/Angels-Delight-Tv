// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { readGuestProgress, writeGuestProgress } from '../../lib/guest/progress-store';
import { GuestContinueRow } from './GuestContinueRow';

const A = '11111111-1111-4111-8111-111111111111';
const card = (id: string, title: string) => ({
  kind: 'video',
  id,
  slug: id,
  title,
  description: '',
  durationMs: 600_000,
  kidsSafe: true,
  hasCaptions: false,
  poster: null,
  categorySlug: 'science',
  categoryName: 'Science',
  publishedAt: null,
});

const mount = () =>
  render(
    <ToastProvider>
      <GuestContinueRow />
    </ToastProvider>,
  );

describe('GuestContinueRow (R14)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows nothing and asks for nothing when no progress is saved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount();
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'Continue learning' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists what this device remembers under Continue learning, resuming at the saved second', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe(`/api/titles/batch?ids=${A}`);
      return new Response(JSON.stringify({ items: [card(A, 'How rain is made')] }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    mount();
    expect(await screen.findByRole('heading', { name: 'Continue learning' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /How rain is made/ })).toHaveAttribute(
      'href',
      `/watch/${A}?t=134`,
    );
  });

  it('removes a video from the device and brings it back with Undo', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ items: [card(A, 'How rain is made')] }))),
    );
    mount();
    await screen.findByRole('heading', { name: 'Continue learning' });
    await userEvent.click(screen.getByRole('button', { name: 'More for How rain is made' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove from row' }));
    await waitFor(() => expect(readGuestProgress(localStorage, A)).toBeNull());
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(readGuestProgress(localStorage, A)).toMatchObject({ p: 134, d: 600, f: false });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /How rain is made/ })).toBeInTheDocument(),
    );
  });

  it('shows nothing when the lookup fails, and never throws', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 500 })),
    );
    mount();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Continue learning' })).toBeNull();
  });
});
