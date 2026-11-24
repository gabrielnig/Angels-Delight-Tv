// @vitest-environment jsdom
import { FakeEngine, FakeNetwork } from '@ad/player/testing';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturePlaybackData } from '@/lib/data/playback.fixture';
import { I18nProvider } from '@/lib/i18n/provider';
import { CLIENT_NAMESPACES } from '@/lib/i18n/namespaces';
import { WatchClient } from './WatchClient';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));

describe('WatchClient follows the interface language (M46-S14)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('the client namespaces include the player strings', () => {
    expect(CLIENT_NAMESPACES).toContain('player');
  });

  it('player controls use the catalog of the current locale', async () => {
    const r = await createFixturePlaybackData().getWatchData('v-rain', { profileId: 'p1', kids: false });
    if (r.status !== 'ok') throw new Error('fixture missing');
    const engine = new FakeEngine();
    render(
      <I18nProvider locale="yo" catalog={{ 'player.settings': 'Ètò' } as never}>
        <WatchClient
          data={r.data}
          viewer={{ profileId: 'p1', kids: false }}
          transport="fixture"
          startAt={null}
          testing={{ createEngine: async () => engine, network: new FakeNetwork() }}
        >
          <h1>{r.data.video.title}</h1>
        </WatchClient>
      </I18nProvider>,
    );
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Ètò' })).toBeTruthy();
  });
});
