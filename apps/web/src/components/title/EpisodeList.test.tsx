// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EpisodeList } from './EpisodeList';

const ep = (n: number, extra: object = {}) => ({
  number: n,
  title: `Episode ${n} title`,
  blurb: `Blurb ${n}`,
  durationSeconds: 300,
  href: `/watch/e${n}`,
  watched: false,
  ...extra,
});

const seasons = [
  { number: 1, episodes: [ep(1, { watched: true }), ep(2, { percent: 40 })] },
  { number: 2, episodes: [ep(1)] },
];

describe('EpisodeList', () => {
  it('shows the selected season and lists its episodes', () => {
    render(<EpisodeList seasons={seasons} initialSeason={1} />);
    expect(screen.getByRole('combobox', { name: 'Season' })).toHaveValue('1');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks watched and in-progress episodes in text, not colour alone', () => {
    render(<EpisodeList seasons={seasons} initialSeason={1} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByText('Watched')).toBeInTheDocument();
    expect(within(items[1]!).getByRole('progressbar', { name: /Episode 2/ })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('switches season and announces the count', async () => {
    const user = userEvent.setup();
    render(<EpisodeList seasons={seasons} initialSeason={1} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Season' }), '2');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Season 2, 1 episode')).toHaveAttribute('aria-live', 'polite');
  });

  it('links each episode to its watch page', () => {
    render(<EpisodeList seasons={seasons} initialSeason={1} />);
    expect(screen.getByRole('link', { name: /Episode 1 title/ })).toHaveAttribute(
      'href',
      '/watch/e1',
    );
  });
});
