// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettings } from './NotificationSettings';

const prefs = (over: Record<string, unknown> = {}) => ({
  bell: true,
  newEpisodes: true,
  newVideos: true,
  emailFrequency: 'off',
  addressMasked: null,
  hasAddress: false,
  consentedAt: null,
  ...over,
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const result = handler(String(url), init);
    return result instanceof Response ? result : new Response(JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('NotificationSettings (M44-S14)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads the choices and shows bell and the two kinds on, email off', async () => {
    mockFetch(() => prefs());
    render(<NotificationSettings profileId="p1" />);
    const bell = await screen.findByRole('switch', { name: 'Bell' });
    expect(bell).toBeChecked();
    expect(screen.getByRole('switch', { name: 'New videos in series I follow' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'New videos' })).toBeChecked();
    const group = screen.getByRole('radiogroup', { name: 'Email digest' });
    expect(within(group).getByRole('radio', { name: /Off/ })).toBeChecked();
    expect(screen.queryByText(/push/i)).toBeNull();
    expect(screen.getByText('Security emails about your account are always sent and are not listed here.')).toBeInTheDocument();
  });

  it('a switch saves at once, sending only that change', async () => {
    const fetcher = mockFetch((_url, init) =>
      init?.method === 'PUT' ? prefs({ newVideos: false }) : prefs(),
    );
    render(<NotificationSettings profileId="p1" />);
    const videos = await screen.findByRole('switch', { name: 'New videos' });
    await userEvent.click(videos);
    expect(videos).not.toBeChecked();
    await screen.findByText('Saved');
    const put = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ profileId: 'p1', newVideos: false });
  });

  it('reverts the switch and keeps an error when the save fails', async () => {
    mockFetch((_url, init) => (init?.method === 'PUT' ? new Response('{}', { status: 500 }) : prefs()));
    render(<NotificationSettings profileId="p1" />);
    const bell = await screen.findByRole('switch', { name: 'Bell' });
    await userEvent.click(bell);
    await waitFor(() => expect(bell).toBeChecked());
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save that. Try again.');
  });

  it('turning email on asks for a plain confirmation before anything is saved', async () => {
    const fetcher = mockFetch((_url, init) =>
      init?.method === 'PUT'
        ? prefs({ emailFrequency: 'daily', addressMasked: 'c***@example.org', hasAddress: true, consentedAt: '2026-11-24T08:00:00Z' })
        : prefs(),
    );
    render(<NotificationSettings profileId="p1" />);
    await userEvent.click(await screen.findByRole('radio', { name: /Daily/ }));
    expect(screen.getByText('Turn on the daily email?')).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Turn on the daily email?')).toBeNull();
    expect(screen.getByRole('radio', { name: /Off/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Daily/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, send it' }));
    expect(await screen.findByText('Sent to c***@example.org. Change it in Account overview.')).toBeInTheDocument();
    expect(screen.getByText(/You agreed on 24 Nov 2026/)).toBeInTheDocument();
    const put = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ profileId: 'p1', email: { frequency: 'daily', confirm: true } });
  });

  it('switching email off needs no confirmation, and Daily to Weekly keeps the consent', async () => {
    const fetcher = mockFetch((_url, init) => {
      if (init?.method !== 'PUT') return prefs({ emailFrequency: 'daily', addressMasked: 'c***@example.org', hasAddress: true, consentedAt: '2026-11-24T08:00:00Z' });
      const body = JSON.parse(String(init.body));
      return prefs({ emailFrequency: body.email.frequency, addressMasked: body.email.frequency === 'off' ? null : 'c***@example.org', consentedAt: body.email.frequency === 'off' ? null : '2026-11-24T08:00:00Z' });
    });
    render(<NotificationSettings profileId="p1" />);
    await userEvent.click(await screen.findByRole('radio', { name: /Weekly/ }));
    expect(screen.queryByText('Turn on the weekly email?')).toBeNull();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Weekly/ })).toBeChecked());
    await userEvent.click(screen.getByRole('radio', { name: /Off/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Off/ })).toBeChecked());
    expect(screen.queryByText(/Sent to/)).toBeNull();
    const puts = fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(String(init?.body)));
    expect(puts[0].email).toEqual({ frequency: 'weekly', confirm: true });
    expect(puts[1].email).toEqual({ frequency: 'off' });
  });

  it('shows a load error without switches', async () => {
    mockFetch(() => new Response('{}', { status: 500 }));
    render(<NotificationSettings profileId="p1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your notification settings.');
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
