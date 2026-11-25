// @vitest-environment jsdom
import { Children, isValidElement, type ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFixtureVideo } from '@/lib/data/admin/analytics-rules';
import { getStore } from '@/lib/data/admin/store';
import { Chart } from './Chart';
import { VideoAnalyticsView } from './AnalyticsView';

afterEach(cleanup);
const range = { from: '2026-10-21', to: '2026-11-17' };

/** Every prop that is a function on a Chart in the tree. A server page cannot send these to a client component. */
function functionPropsOnCharts(node: ReactNode, found: string[] = []): string[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    if (child.type === Chart) {
      for (const [key, value] of Object.entries(props)) if (typeof value === 'function') found.push(key);
    }
    functionPropsOnCharts(props.children as ReactNode, found);
  });
  return found;
}

describe('VideoAnalyticsView on a server page', () => {
  it('passes no function to the Chart client component', () => {
    const data = buildFixtureVideo(getStore(), 'vid_hygiene', range, new Date('2026-11-17T10:00:00Z'))!;
    const tree = VideoAnalyticsView({ data, preset: '28d' });
    expect(functionPropsOnCharts(tree)).toEqual([]);
  });
  it('still draws Where viewers stop as percents', () => {
    const data = buildFixtureVideo(getStore(), 'vid_hygiene', range, new Date('2026-11-17T10:00:00Z'))!;
    render(<VideoAnalyticsView data={data} preset="28d" />);
    expect(screen.getByText('Where viewers stop')).toBeTruthy();
  });
});
