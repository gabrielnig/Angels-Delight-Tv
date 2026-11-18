import { describe, expect, it, vi } from 'vitest';
import { createWatchTelemetry } from './telemetry';

const VIDEO = '3f1c2a9e-5b7d-4c1e-9a52-0d6b8f4e7a11';

function setup(durationSeconds = 120) {
  const events: Array<Record<string, unknown>> = [];
  const t = createWatchTelemetry({
    videoId: VIDEO,
    durationSeconds,
    client: { track: (e) => void events.push(e as Record<string, unknown>) },
  });
  return { t, events };
}

describe('watch telemetry (M08-S30)', () => {
  it('sends startup time for the quality dashboard', () => {
    const { t, events } = setup();
    t.onStartup(850);
    expect(events).toContainEqual({ kind: 'startup', videoId: VIDEO, startupMs: 850 });
  });

  it('counts a view after real playback and sends progress on pause', () => {
    const { t, events } = setup();
    for (let ms = 0; ms <= 4_000; ms += 1_000) t.onTimeUpdate(ms, true);
    t.onPause();
    expect(events.some((e) => e.kind === 'view_start')).toBe(true);
    expect(events.some((e) => e.kind === 'progress')).toBe(true);
  });

  it('sends an error event with a code and the video id', () => {
    const { t, events } = setup();
    t.onError('player.network');
    expect(events).toContainEqual({ kind: 'error', code: 'player.network', videoId: VIDEO });
  });

  it('keeps the highest rendition the viewer reached', () => {
    const { t, events } = setup();
    t.setHeight(360);
    t.setHeight(720);
    t.setHeight(480);
    for (let ms = 0; ms <= 4_000; ms += 1_000) t.onTimeUpdate(ms, true);
    expect(events.find((e) => e.kind === 'view_start')).toMatchObject({ maxHeight: 720 });
  });

  it('drops codes that do not fit the taxonomy instead of sending them', () => {
    const { t, events } = setup();
    t.onError('Something Went Wrong!');
    expect(events).toEqual([]);
  });

  it('never throws when the client does', () => {
    const t = createWatchTelemetry({
      videoId: VIDEO,
      durationSeconds: 60,
      client: {
        track: vi.fn(() => {
          throw new Error('down');
        }),
      },
    });
    expect(() => {
      t.onStartup(100);
      t.onError('player.media');
      t.onEnded();
    }).not.toThrow();
  });
});
