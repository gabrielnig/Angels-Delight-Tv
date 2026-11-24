// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { TitleRating } from './TitleRating';

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const target = { profileId: 'p1', kind: 'video' as const, id: 'v1' };

afterEach(() => vi.unstubAllGlobals());

describe('TitleRating', () => {
  it('loads the current rating and saves a change through PUT /api/ratings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<TitleRating target={target} />);
    const group = await screen.findByRole('group', { name: 'Rate this title' });
    await waitFor(() =>
      expect(within(group).getByRole('button', { name: 'I like this' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await userEvent.click(within(group).getByRole('button', { name: 'Love this' }));
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/ratings');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({
      profileId: 'p1',
      target: { kind: 'video', id: 'v1' },
      value: 2,
    });
  });

  it('a guest tap opens the Sign in to save dialog and never calls the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wrap(<TitleRating guest={{ signUpOpen: true, next: '/title/a', itemKey: 'video:v1' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'I like this' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remembers the chosen value for after sign in', async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    wrap(<TitleRating guest={{ signUpOpen: true, next: '/title/a', itemKey: 'video:v1' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Love this' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getAllByRole('link')[0]!);
    expect(JSON.parse(localStorage.getItem('ad:guest:intent:v1')!)).toMatchObject({
      kind: 'like',
      itemKey: 'video:v1',
      value: 2,
    });
  });
});
