// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { GUEST_INTENT_KEY, saveIntent } from '../../lib/guest/intent';

const toggle = vi.hoisted(() => vi.fn(async () => 'sent' as const));
vi.mock('../../lib/pwa/useListToggle', () => ({ useListToggle: () => toggle }));
vi.mock('../../lib/profile-context', () => ({ useProfileId: () => 'p1' }));

import { GuestIntentApplier } from './GuestIntentApplier';

const mount = () =>
  render(
    <ToastProvider>
      <GuestIntentApplier />
    </ToastProvider>,
  );

describe('GuestIntentApplier', () => {
  beforeEach(() => {
    localStorage.clear();
    toggle.mockClear();
    vi.unstubAllGlobals();
  });

  it('adds what the visitor wanted to save and says so', async () => {
    saveIntent(localStorage, { kind: 'my-list', itemKey: 'video:a' });
    mount();
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('video:a', true));
    expect(await screen.findByText('Added to My List')).toBeInTheDocument();
    expect(localStorage.getItem(GUEST_INTENT_KEY)).toBeNull();
  });

  it('does nothing when there is no intent', async () => {
    mount();
    await Promise.resolve();
    expect(toggle).not.toHaveBeenCalled();
  });

  it('replays the chosen like through PUT /api/ratings and says so', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    saveIntent(localStorage, { kind: 'like', itemKey: 'series:s9', value: 2 });
    mount();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ratings');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      profileId: 'p1',
      target: { kind: 'series', id: 's9' },
      value: 2,
    });
    expect(await screen.findByText('Rating saved')).toBeInTheDocument();
    expect(toggle).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_INTENT_KEY)).toBeNull();
  });

  it('shows an error when the rating cannot be saved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    saveIntent(localStorage, { kind: 'like', itemKey: 'video:a', value: 1 });
    mount();
    expect(await screen.findByText(/could not save your rating/i)).toBeInTheDocument();
  });

  it('ignores a like with no value', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    saveIntent(localStorage, { kind: 'like', itemKey: 'video:a' });
    mount();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
