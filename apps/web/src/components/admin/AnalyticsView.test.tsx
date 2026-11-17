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
