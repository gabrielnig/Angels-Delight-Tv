// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { GUEST_INTENT_KEY, saveIntent } from '../../lib/guest/intent';

const toggle = vi.hoisted(() => vi.fn(async () => 'sent' as const));
vi.mock('../../lib/pwa/useListToggle', () => ({ useListToggle: () => toggle }));

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

  it('leaves a like intent alone', async () => {
    saveIntent(localStorage, { kind: 'like', itemKey: 'video:a' });
    mount();
    await Promise.resolve();
    expect(toggle).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_INTENT_KEY)).not.toBeNull();
  });
});
