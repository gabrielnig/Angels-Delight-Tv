import { describe, expect, it } from 'vitest';
import { seedStore } from '../store';
import { applyDemo } from './apply';
import { DEMO_NOW_ISO } from './dataset';

const now = Date.parse(DEMO_NOW_ISO);
const demo = () => applyDemo(seedStore(now), undefined, now);

describe('troubleshooting states of the demo (lane C7)', () => {
  it('has a failed caption track, a failed and a skipped preview clip, and a failed encode', () => {
    const store = demo();
    const by = (id: string) => store.videos.find((v) => v.id === id)!;
    expect(by('vid_fractions').captionState).toBe('failed');
    expect(by('vid_decimals').preview?.state).toBe('failed');
    expect(by('vid_hygiene').preview?.state).toBe('skipped');
    expect(by('vid_solar').status).toBe('failed');
  });

  it('has a series whose second lesson is a draft, and an email job that failed', () => {
    const store = demo();
    const lessons = store.videos.filter((v) => v.seriesId === 'ser_demo_garden');
    expect(lessons.map((v) => v.publishState).sort()).toEqual(['draft', 'published']);
    expect(store.series.find((s) => s.id === 'ser_demo_garden')?.published).toBe(true);
    expect(store.jobs.some((j) => j.kind === 'email' && j.state === 'failed')).toBe(true);
  });

  it('is the same every time', () => {
    expect(JSON.stringify(demo())).toBe(JSON.stringify(demo()));
  });
});
