// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFixtureOverview, buildFixtureVideo } from '@/lib/data/admin/analytics-rules';
import { getStore } from '@/lib/data/admin/store';
import { AnalyticsOverviewView, VideoAnalyticsView } from './AnalyticsView';

afterEach(cleanup);
const range = { from: '2026-10-21', to: '2026-11-17' };

describe('AnalyticsOverviewView', () => {
  it('shows tiles with change in words, a chart and top titles', () => {
    render(
      <AnalyticsOverviewView
        data={buildFixtureOverview(getStore(), range, new Date('2026-11-17T10:00:00Z'))}
        preset="28d"
        exportHref="/x"
      />,
    );
    for (const name of ['Views', 'Unique viewers', 'Watch time', 'Finished watching'])
      expect(screen.getByRole('group', { name })).toBeTruthy();
    expect(
      within(screen.getByRole('group', { name: 'Views' })).getByText(/from the period before/),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Most watched titles' })).toBeTruthy();
  });
  describe('Top titles ratings (L5 M44-S06)', () => {
    const data = () => {
      const base = buildFixtureOverview(getStore(), range, new Date('2026-11-17T10:00:00Z'));
      const [a, b, c] = base.top;
      return {
        ...base,
        top: [
          { ...a!, title: 'Alpha', views: 300, ratings: { likes: 6, loves: 2, dislikes: 2 } },
          { ...b!, title: 'Beta', views: 200, ratings: { likes: 20, loves: 10, dislikes: 10 } },
          { ...c!, title: 'Gamma', views: 100, ratings: { likes: 1, loves: 0, dislikes: 0 } },
          { ...base.top[3]!, title: 'Delta', views: 50 },
        ],
      };
    };
    const rows = () =>
      within(screen.getByRole('table', { name: 'Most watched titles' }))
        .getAllByRole('row')
        .slice(1);
    const titles = () => rows().map((r) => within(r).getAllByRole('rowheader')[0]!.textContent);

    it('shows Likes, Love, Not for me and Positive share, and says when there are too few ratings', () => {
      render(<AnalyticsOverviewView data={data()} preset="28d" exportHref="/x" />);
      for (const name of ['Likes', 'Love', 'Not for me', 'Positive share'])
        expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeTruthy();
      const alpha = rows()[0]!;
      expect(within(alpha).getByText('80%')).toBeTruthy();
      expect(within(rows()[2]!).getByText('Under 10 ratings')).toBeTruthy();
      expect(within(rows()[3]!).getAllByText('No ratings').length).toBeGreaterThan(0);
    });

    it('sorts by a rating column, highest first, then flips, with aria-sort', () => {
      render(<AnalyticsOverviewView data={data()} preset="28d" exportHref="/x" />);
      expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
      fireEvent.click(screen.getByRole('button', { name: /Sort by Likes/ }));
      expect(titles()).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta']);
      expect(screen.getByRole('columnheader', { name: /Likes/ }).getAttribute('aria-sort')).toBe('descending');
      fireEvent.click(screen.getByRole('button', { name: /Sort by Likes/ }));
      expect(titles()).toEqual(['Gamma', 'Alpha', 'Beta', 'Delta']);
      fireEvent.click(screen.getByRole('button', { name: /Sort by Positive share/ }));
      expect(titles()).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
  });

  it('the chart can be read as a table', () => {
    render(
      <AnalyticsOverviewView
        data={buildFixtureOverview(getStore(), range, new Date('2026-11-17T10:00:00Z'))}
        preset="28d"
        exportHref="/x"
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Show as table' })[0]!);
    expect(screen.getByRole('table', { name: 'Views each day' })).toBeTruthy();
  });
  it('has an empty state and marks the current range', () => {
    const empty = buildFixtureOverview(getStore(), { from: '2020-01-01', to: '2020-01-07' });
    render(<AnalyticsOverviewView data={empty} preset="7d" exportHref="/x" />);
    expect(screen.getByText('No views in this period.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Last 7 days' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });
});

describe('VideoAnalyticsView', () => {
  it('shows retention as a second chart', () => {
    const s = getStore();
    const data = buildFixtureVideo(
      s,
      s.videos.find((v) => v.publishState === 'published' && v.views > 0)!.id,
      range,
      new Date('2026-11-17T10:00:00Z'),
    )!;
    render(<VideoAnalyticsView data={data} preset="28d" />);
    expect(screen.getByText('Share of viewers still watching')).toBeTruthy();
  });
});
