// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityView } from './ActivityView';

const NOW = new Date('2026-11-25T15:00:00Z');
const entry = (id: string, title: string, iso: string, over = {}) => ({
  videoId: id,
  title,
  seriesTitle: null,
  episodeLabel: null,
  slug: id,
  posterUrl: null,
  posterAlt: null,
  watchedAt: iso,
  completed: false,
  progressPct: 40,
  ...over,
});
const profiles = [
  { id: 'p1', name: 'Ada' },
  { id: 'p2', name: 'Tobi' },
];

function actions(over: Record<string, unknown> = {}) {
  return {
    load: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    remove: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue({ cleared: 2 }),
    ...over,
  };
}

const initial = {
  items: [
    entry('v1', 'Fractions', '2026-11-25T09:00:00Z'),
    entry('v2', 'Decimals', '2026-11-24T09:00:00Z', {
      seriesTitle: 'Maths',
      episodeLabel: 'S1 E2',
    }),
  ],
  nextCursor: null,
};

describe('ActivityView', () => {
  it('groups by day and shows episode, series and progress', () => {
    render(
      <ActivityView profiles={profiles} activeId="p1" initial={initial} now={NOW} {...actions()} />,
    );
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getByText('Maths, S1 E2')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('remove leaves the list at once and offers Undo, which brings it back', async () => {
    const a = actions();
    const user = userEvent.setup();
    render(<ActivityView profiles={profiles} activeId="p1" initial={initial} now={NOW} {...a} />);
    await user.click(
      screen.getByRole('button', { name: 'Remove Fractions from viewing activity' }),
    );
    expect(screen.queryByText('Fractions')).toBeNull();
    expect(a.remove).toHaveBeenCalledWith('p1', 'v1');
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(a.restore).toHaveBeenCalledWith('p1', 'v1');
    expect(await screen.findByText('Fractions')).toBeInTheDocument();
  });

  it('a failed remove restores the row and says so', async () => {
    const a = actions({ remove: vi.fn().mockRejectedValue(new Error('x')) });
    const user = userEvent.setup();
    render(<ActivityView profiles={profiles} activeId="p1" initial={initial} now={NOW} {...a} />);
    await user.click(
      screen.getByRole('button', { name: 'Remove Fractions from viewing activity' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not remove that title');
    expect(screen.getByText('Fractions')).toBeInTheDocument();
  });

  it('empty list shows the message with one Browse action and hides Clear', () => {
    render(
      <ActivityView
        profiles={profiles}
        activeId="p1"
        initial={{ items: [], nextCursor: null }}
        now={NOW}
        {...actions()}
      />,
    );
    expect(
      screen.getByText('Nothing here yet. Titles you watch will show up here.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse titles' })).toHaveAttribute('href', '/browse');
    expect(screen.queryByRole('button', { name: 'Clear activity' })).toBeNull();
  });

  it('switching the profile tab loads that profile only', async () => {
    const load = vi.fn().mockResolvedValue({
      items: [entry('v9', 'Shapes', '2026-11-25T08:00:00Z')],
      nextCursor: null,
    });
    const user = userEvent.setup();
    render(
      <ActivityView
        profiles={profiles}
        activeId="p1"
        initial={initial}
        now={NOW}
        {...actions({ load })}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Tobi' }));
    expect(load).toHaveBeenCalledWith('p2', undefined);
    expect(await screen.findByText('Shapes')).toBeInTheDocument();
    expect(screen.queryByText('Fractions')).toBeNull();
  });

  it('a load failure shows an inline retry', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue({ items: [], nextCursor: null });
    const user = userEvent.setup();
    render(
      <ActivityView
        profiles={profiles}
        activeId="p1"
        initial={initial}
        now={NOW}
        {...actions({ load })}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Tobi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this list.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('Show more appends the next page', async () => {
    const load = vi.fn().mockResolvedValue({
      items: [entry('v3', 'Angles', '2026-11-20T08:00:00Z')],
      nextCursor: null,
    });
    const user = userEvent.setup();
    render(
      <ActivityView
        profiles={profiles}
        activeId="p1"
        initial={{ ...initial, nextCursor: 'c1' }}
        now={NOW}
        {...actions({ load })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(load).toHaveBeenCalledWith('p1', 'c1');
    expect(await screen.findByText('Angles')).toBeInTheDocument();
    expect(screen.getByText('Fractions')).toBeInTheDocument();
  });

  it('clear all: dialog says the account stays, confirm clears, cancel changes nothing', async () => {
    const a = actions();
    const user = userEvent.setup();
    render(<ActivityView profiles={profiles} activeId="p1" initial={initial} now={NOW} {...a} />);
    await user.click(screen.getByRole('button', { name: 'Clear activity' }));
    let dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('does not delete your account');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(a.clear).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Clear activity' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Clear activity' }));
    expect(a.clear).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByText('Fractions')).toBeNull());
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it('links to Download my data', () => {
    render(
      <ActivityView profiles={profiles} activeId="p1" initial={initial} now={NOW} {...actions()} />,
    );
    expect(screen.getByRole('link', { name: 'Download my data first' })).toHaveAttribute(
      'href',
      '/account/data',
    );
  });
});
