import { describe, expect, it } from 'vitest';
import { PROGRESS_ENDPOINT } from './routes';
import { toViewerProgressBody } from './progress-body';

const update = {
  videoId: '0198a000-0000-7000-8000-000000000001',
  profileId: '0198a000-0000-7000-8000-000000000002',
  positionSeconds: 83.4567,
  durationSeconds: 600,
  ended: false,
};

describe('progress sink wiring', () => {
  it('posts to the viewer progress route', () => {
    expect(PROGRESS_ENDPOINT).toBe('/api/progress');
  });

  it('maps a player update to the POST /api/progress body', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(toViewerProgressBody(update, () => now)).toEqual({
      profileId: update.profileId,
      videoId: update.videoId,
      positionMs: 83_457,
      ended: false,
      clientTimestamp: '2026-06-15T12:00:00.000Z',
    });
  });

  it('passes the end of the video and never sends a negative or fractional position', () => {
    const ended = toViewerProgressBody({ ...update, positionSeconds: 600, ended: true });
    expect(ended).toMatchObject({ positionMs: 600_000, ended: true });
    expect(toViewerProgressBody({ ...update, positionSeconds: -3 }).positionMs).toBe(0);
    expect(
      Number.isInteger(toViewerProgressBody({ ...update, positionSeconds: 1.0004 }).positionMs),
    ).toBe(true);
  });
});
