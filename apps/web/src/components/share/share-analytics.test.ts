import { SHARE_CHANNELS } from '@ad/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
const state = { fail: false };
vi.mock('../../lib/analytics/browser', () => ({
  getAnalyticsClient: () => {
    if (state.fail) throw new Error('blocked');
    return { track };
  },
}));

import { SHARE_TARGET_IDS } from './share-targets';
import { trackShare } from './share-analytics';

beforeEach(() => {
  track.mockReset();
  state.fail = false;
});

describe('trackShare (L15a slice 4)', () => {
  it('sends the place and the title kind and nothing else', () => {
    trackShare('whatsapp', 'video');
    expect(track).toHaveBeenCalledWith({ kind: 'share', channel: 'whatsapp', titleKind: 'video' });
    expect(Object.keys(track.mock.calls[0]?.[0] as object).sort()).toEqual(['channel', 'kind', 'titleKind']);
  });

  it('never throws when the client fails', () => {
    state.fail = true;
    expect(() => trackShare('copy', 'series')).not.toThrow();
  });

  it('knows exactly the places the sheet lists', () => {
    expect([...SHARE_CHANNELS]).toEqual([...SHARE_TARGET_IDS]);
  });
});
