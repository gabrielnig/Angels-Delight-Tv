// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PanelData } from '@/lib/admin/help-panel';

let pathname = '/admin/videos/upload';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const { HelpPanelHost, useHelpPanel } = await import('./HelpPanelHost');
const { HelpLink } = await import('./HelpLink');
const { HelpMapProvider } = await import('./HelpMapProvider');

const guide = (id: string, extra: Partial<PanelData['guides'][number]> = {}) => ({
  id,
  title: `Guide ${id}`,
  summary: `Summary of ${id}.`,
  readMinutes: 3,
  higher: false,
  href: `/admin/help/${id}`,
  steps: [
    { id: 'step-1', c: [{ t: 'text' as const, v: 'Choose Upload.' }] },
    { id: 'step-2', c: [{ t: 'text' as const, v: 'Pick a file.' }] },
  ],
  ...extra,
});
const data = (over: Partial<PanelData> = {}): PanelData => ({
  pathname,
  guides: [guide('D01')],
  core: [{ id: 'S01', title: 'Find your way', href: '/admin/help/S01' }],
  ...over,
});
const result = (d: PanelData) => ({ ok: true as const, data: d, cues: [] });

const load = vi.fn();
const onWatched = vi.fn(async () => ({ ok: true }));

function Page() {
  return (
    <>
      <button type="button" id="before">
        before
      </button>
      <HelpLink placement="top" />
      <input aria-label="A field" />
      <Tools />
    </>
  );
}
function Tools() {
  const p = useHelpPanel();
  return (
    <button type="button" onClick={() => p.open({ guide: 'D01', section: 'step-2' })}>
      Open D01 step two
    </button>
  );
}
const setup = () =>
  render(
    <HelpMapProvider map={{ '/admin/videos/upload': ['D01'] }}>
      <HelpPanelHost load={load} onWatched={onWatched}>
        <Page />
      </HelpPanelHost>
    </HelpMapProvider>,
  );

beforeEach(() => {
  pathname = '/admin/videos/upload';
  load.mockReset();
  load.mockImplementation(async () => result(data()));
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const helpButton = () => screen.getByRole('link', { name: 'Help' });

describe('HelpPanelHost (M50-S03)', () => {
  it('keeps the Help link as a real link to the full guide and opens the panel on click', async () => {
    const user = userEvent.setup();
    setup();
    expect(helpButton()).toHaveAttribute('href', '/admin/help/D01');
    await user.click(helpButton());
    const panel = await screen.findByRole('dialog', { name: 'Help for this screen' });
    expect(within(panel).getByRole('heading', { name: 'Guide D01' })).toBeInTheDocument();
    expect(within(panel).getByText('Choose Upload.')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Open the full guide' })).toHaveAttribute(
      'href',
      '/admin/help/D01',
    );
    expect(load).toHaveBeenCalledWith('/admin/videos/upload', undefined);
  });

  it('moves focus into the panel, traps Tab, and returns focus to Help on Escape', async () => {
    const user = userEvent.setup();
    setup();
    helpButton().focus();
    await user.click(helpButton());
    const panel = await screen.findByRole('dialog');
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(panel.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(panel.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(helpButton());
  });

  it('closes with the Close button and returns focus', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    await user.click(await screen.findByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(helpButton());
  });

  it('closes with a swipe down on the handle', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    const handle = await screen.findByTestId('help-sheet-handle');
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 220 }] });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens with the question mark key only when no field has focus', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('textbox', { name: 'A field' }).focus();
    await user.keyboard('?');
    expect(screen.queryByRole('dialog')).toBeNull();
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('?');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('updates when the person moves to another page', async () => {
    const user = userEvent.setup();
    const view = setup();
    await user.click(helpButton());
    await screen.findByRole('heading', { name: 'Guide D01' });
    pathname = '/admin/captions';
    load.mockImplementation(async () =>
      result(data({ pathname, guides: [guide('D07', { title: 'Approve captions' })] })),
    );
    view.rerender(
      <HelpMapProvider map={{}}>
        <HelpPanelHost load={load} onWatched={onWatched}>
          <Page />
        </HelpPanelHost>
      </HelpMapProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Approve captions' })).toBeInTheDocument();
  });

  it('lists two guides with the main one first', async () => {
    load.mockImplementation(async () =>
      result(data({ guides: [guide('D01'), guide('D05', { title: 'Related guide' })] })),
    );
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    const panel = await screen.findByRole('dialog');
    const heads = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(heads).toEqual(['Guide D01', 'Related guide']);
  });

  it('shows search and the core tasks when no guide matches', async () => {
    load.mockImplementation(async () => result(data({ guides: [] })));
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('No guide for this screen yet')).toBeInTheDocument();
    expect(within(panel).getByRole('searchbox', { name: 'Search help' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Find your way' })).toHaveAttribute(
      'href',
      '/admin/help/S01',
    );
    expect(within(panel).getByRole('link', { name: 'Browse all guides' })).toHaveAttribute(
      'href',
      '/admin/help',
    );
  });

  it('labels a guide for a higher role', async () => {
    load.mockImplementation(async () => result(data({ guides: [guide('D02', { higher: true })] })));
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    expect(await screen.findByText('For a higher role')).toBeInTheDocument();
  });

  it('shows a skeleton only after 300 ms and a slow note after 6 s', async () => {
    vi.useFakeTimers();
    load.mockImplementation(() => new Promise(() => {}));
    setup();
    fireEvent.click(helpButton());
    expect(screen.queryByRole('status', { name: 'Loading help' })).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByRole('status', { name: 'Loading help' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/Still loading/)).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('Still loading. Your connection may be slow.')).toBeInTheDocument();
  });

  it('shows one action when the guide cannot load, and retries', async () => {
    load.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Guide D01' })).toBeInTheDocument();
  });

  it('keeps the saved guide readable offline and says the video needs data', async () => {
    load.mockImplementation(async () =>
      result(
        data({
          guides: [guide('D01', { video: { id: 'VD01', phone: false, captions: 'track' } })],
        }),
      ),
    );
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    await screen.findByRole('heading', { name: 'Guide D01' });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText(/You are offline\. Check your data or Wi-Fi/)).toBeInTheDocument();
    expect(within(panel).getByText('Choose Upload.')).toBeInTheDocument();
    expect(within(panel).getByText('The video needs data')).toBeInTheDocument();
    expect(panel.querySelector('video')).toBeNull();
  });

  it('offline with nothing saved shows one action', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    load.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    setup();
    await user.click(helpButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You are offline');
    expect(within(alert).getAllByRole('button')).toHaveLength(1);
  });

  it('opens a named guide at a section from an inline hint and keeps the page', async () => {
    load.mockImplementation(async () =>
      result(data({ guides: [guide('D01')] })),
    );
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Open D01 step two' }));
    await screen.findByRole('dialog');
    expect(load).toHaveBeenCalledWith('/admin/videos/upload', 'D01');
    expect(screen.getByRole('textbox', { name: 'A field' })).toBeInTheDocument();
  });
});
