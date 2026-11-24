// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { listGuestProgress, writeGuestProgress } from '../../lib/guest/progress-store';
import { ImportPrompt } from './ImportPrompt';

const A = '11111111-1111-4111-8111-111111111111';
const mount = (props: Partial<React.ComponentProps<typeof ImportPrompt>> = {}) =>
  render(
    <ToastProvider>
      <ImportPrompt profileId="p1" kids={false} {...props} />
    </ToastProvider>,
  );

describe('ImportPrompt (S86)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('asks nothing when this device has no history', async () => {
    mount();
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks nothing of a kids profile', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    mount({ kids: true });
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers to add the device history, and moves it when accepted', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ imported: 1, skipped: 0 })));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    expect(
      await screen.findByRole('dialog', { name: 'Add what you watched here?' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add to my history' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/progress/import');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).profileId).toBe('p1');
    await waitFor(() => expect(listGuestProgress(localStorage)).toHaveLength(0));
    expect(await screen.findByText('Added 1 video to your history')).toBeInTheDocument();
  });

  it('keeps the device history on Not now and does not ask again this visit', async () => {
    writeGuestProgress(localStorage, A, { p: 134, d: 600, f: false });
    const view = mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(listGuestProgress(localStorage)).toHaveLength(1);
    view.unmount();
    mount();
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
