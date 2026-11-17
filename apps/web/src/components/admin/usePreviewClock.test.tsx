// @vitest-environment jsdom
import { SessionError } from '@ad/player';
import { FakeEngine } from '@ad/player/testing';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreviewClock, type PreviewClock } from './usePreviewClock';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const provider = (fail?: SessionError) => ({
  createSession: vi.fn(async (_videoId: string, _signal?: AbortSignal) => {
    if (fail) throw fail;
    return { token: 't', expiresAt: Date.now() + 3_600_000, masterUrl: 'https://a.test/m.m3u8' };
  }),
});

let latest: PreviewClock;
function Probe(props: Parameters<typeof usePreviewClock>[0]) {
  latest = usePreviewClock(props);
  return <video ref={latest.videoRef} data-testid="video" />;
}

async function mount(extra: Partial<Parameters<typeof usePreviewClock>[0]> = {}) {
  const engine = new FakeEngine();
  let media: HTMLVideoElement | undefined;
  const props = {
    videoId: 'v1',
    durationMs: 60_000,
    enabled: true,
    appOrigin: 'https://a.test',
    sessionProvider: provider(),
    createEngine: async (video: HTMLVideoElement) => {
      media = video;
      video.play = vi.fn(async () => {
        Object.defineProperty(video, 'paused', { value: false, configurable: true });
        video.dispatchEvent(new Event('play'));
        video.dispatchEvent(new Event('playing'));
      });
      video.pause = vi.fn(() => {
        Object.defineProperty(video, 'paused', { value: true, configurable: true });
        video.dispatchEvent(new Event('pause'));
      });
      return engine;
    },
    ...extra,
  };
  render(<Probe {...props} />);
  if (props.enabled) await waitFor(() => expect(latest.status).toBe('ready'));
  return { engine, media: () => media!, props };
}

describe('usePreviewClock', () => {
  it('runs the simulated clock when preview is off', async () => {
    vi.useFakeTimers();
    render(<Probe videoId="v1" durationMs={1000} enabled={false} appOrigin="" />);
    expect(latest.status).toBe('off');
    act(() => latest.toggle());
    expect(latest.playing).toBe(true);
    act(() => void vi.advanceTimersByTime(300));
    expect(latest.ms).toBe(300);
    act(() => latest.seek(5000));
    expect(latest.ms).toBe(1000);
  });

  it('follows the real player time and play state once the preview session is up', async () => {
    const { engine, media } = await mount();
    expect(engine.loads).toHaveLength(1);
    expect(latest.ms).toBe(0);
    act(() => latest.toggle());
    await waitFor(() => expect(latest.playing).toBe(true));
    act(() => {
      Object.defineProperty(media(), 'currentTime', {
        value: 4.25,
        configurable: true,
        writable: true,
      });
      media().dispatchEvent(new Event('timeupdate'));
    });
    await waitFor(() => expect(latest.ms).toBe(4250));
  });

  it('seeks the real video and clamps to the duration', async () => {
    const { media } = await mount();
    act(() => latest.seek(12_000));
    expect(media().currentTime).toBe(12);
    await waitFor(() => expect(latest.ms).toBe(12_000));
  });

  it('asks for the preview session of this video', async () => {
    const p = provider();
    await mount({ sessionProvider: p });
    expect(p.createSession.mock.calls[0]?.[0]).toBe('v1');
  });

  it('falls back to the simulated clock when the session is refused', async () => {
    await mount().catch(() => undefined);
    cleanup();
    render(
      <Probe
        videoId="v1"
        durationMs={1000}
        enabled
        appOrigin="https://a.test"
        sessionProvider={provider(new SessionError('gone'))}
        createEngine={async () => new FakeEngine()}
      />,
    );
    await waitFor(() => expect(latest.status).toBe('unavailable'));
    vi.useFakeTimers();
    act(() => latest.toggle());
    act(() => void vi.advanceTimersByTime(200));
    expect(latest.ms).toBe(200);
  });
});
