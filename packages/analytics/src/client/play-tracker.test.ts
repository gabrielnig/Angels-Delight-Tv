import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent } from '../events';
import { createPlayTracker } from './play-tracker';

const videoId = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';

function setup(durationMs = 100_000) {
  const events: AnalyticsEvent[] = [];
  const tracker = createPlayTracker({
    videoId,
    durationMs,
    track: (event) => events.push(event),
    randomUUID: () => '3f2b8c1e-5d4a-4e7b-9a1c-0d2e4f6a8b10',
  });
  /** Plays `seconds` of continuous playback from `from`, one second per tick. */
  const play = (fromMs: number, seconds: number) => {
    for (let i = 1; i <= seconds; i += 1) tracker.onTimeUpdate(fromMs + i * 1000, true);
  };
  return { events, tracker, play };
}
const kinds = (events: AnalyticsEvent[]) => events.map((event) => event.kind);

describe('createPlayTracker', () => {
  it('records a view once after 3 seconds have played', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 2);
    expect(kinds(events)).toEqual([]);
    play(2000, 2);
    expect(kinds(events)).toEqual(['view_start']);
    play(4000, 1);
    expect(kinds(events).filter((kind) => kind === 'view_start')).toHaveLength(1);
  });

  it('saves progress every 10 seconds of watch time', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 21);
    const progress = events.filter((event) => event.kind === 'progress');
    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ watchedMs: 10_000 });
    expect(progress[1]).toMatchObject({ watchedMs: 20_000 });
  });

  it('does not count seek jumps as watch time', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 5);
    tracker.onTimeUpdate(60_000, true);
    play(60_000, 2);
    tracker.onPause();
    const last = events.filter((event) => event.kind === 'progress').at(-1);
    expect(last).toMatchObject({ watchedMs: 7000 });
  });

  it('does not count time while paused', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 4);
    tracker.onTimeUpdate(5000, false);
    tracker.onTimeUpdate(6000, false);
    tracker.onPause();
    expect(events.filter((event) => event.kind === 'progress').at(-1)).toMatchObject({
      watchedMs: 4000,
    });
  });

  it('records completion once at the finish threshold', () => {
    const { events, tracker } = setup(10_000);
    tracker.onTimeUpdate(0, true);
    for (let i = 1; i <= 10; i += 1) tracker.onTimeUpdate(i * 1000, true);
    tracker.onEnded();
    expect(kinds(events).filter((kind) => kind === 'complete')).toHaveLength(1);
    expect(kinds(events)).toContain('view_start');
  });

  it('flushes final progress on pause, hide and end without duplicating when nothing changed', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 6);
    tracker.onPause();
    tracker.onHide();
    expect(events.filter((event) => event.kind === 'progress')).toHaveLength(1);
  });

  it('sends no progress for plays shorter than the view threshold', () => {
    const { events, tracker, play } = setup();
    tracker.onTimeUpdate(0, true);
    play(0, 2);
    tracker.onPause();
    expect(events).toHaveLength(0);
  });

  it('reports startup time and the highest rung played', () => {
    const { events, tracker, play } = setup();
    tracker.onStartup(1400, 200);
    tracker.setHeight(360);
    tracker.setHeight(240);
    tracker.onTimeUpdate(0, true);
    play(0, 4);
    expect(events[0]).toMatchObject({ kind: 'startup', startupMs: 1400, rebufferMs: 200 });
    expect(events.find((event) => event.kind === 'view_start')).toMatchObject({ maxHeight: 360 });
  });

  it('never throws when the sink throws', () => {
    const tracker = createPlayTracker({
      videoId,
      durationMs: 10_000,
      track: () => {
        throw new Error('sink down');
      },
    });
    tracker.onTimeUpdate(0, true);
    expect(() => {
      for (let i = 1; i <= 5; i += 1) tracker.onTimeUpdate(i * 1000, true);
    }).not.toThrow();
  });
});
