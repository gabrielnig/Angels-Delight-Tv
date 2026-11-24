import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView } from './PlayerView';

function setup(preferences: { dataSaver?: boolean } = {}) {
  const media = new FakeMedia();
  const engine = new FakeEngine();
  const onPreferencesChange = vi.fn();
  const controller = new PlayerController({
    media,
    engine,
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    preferences,
    onPreferencesChange,
  });
  controller.start();
  act(() => {
    media.setDuration(300);
    media.emit('playing');
    engine.emit({ type: 'levels', heights: [360, 480, 720] });
  });
  render(<PlayerView controller={controller} title="Rain" reference="AD-7K4Q" />);
  return { media, engine, controller, onPreferencesChange };
}

async function stall(media: FakeMedia, ms: number) {
  await act(async () => {
    media.emit('waiting');
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PlayerView hints and errors (L4-11)', () => {
  it('shows the locked quality hint and its action opens the quality list', async () => {
    const { controller, media } = setup();
    act(() => controller.selectQuality(720));
    await stall(media, 8_100);
    expect(document.querySelector('.adp-hint')?.textContent).toContain(
      'Slow connection. Try Auto or a lower quality',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open quality' }));
    expect(screen.getByRole('menu', { name: 'Quality' })).toBeTruthy();
  });

  it('shows the Data saver hint after two stalls and Turn on saves the preference', async () => {
    const { media, onPreferencesChange } = setup();
    await stall(media, 1_000);
    act(() => media.emit('playing'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await stall(media, 1_000);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ dataSaver: true }),
    );
    expect(screen.queryByText(/Videos load slowly/)).toBeNull();
  });

  it('Dismiss hides the hint', async () => {
    const { controller, media } = setup();
    act(() => controller.selectQuality(720));
    await stall(media, 8_100);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'Open quality' })).toBeNull();
  });

  it('shows the reference after three retries on connection lost, and focuses the action', async () => {
    const { controller, media, engine } = setup();
    media.autoStart = false;
    engine.canDrop = false;
    for (let i = 0; i < 4; i += 1) {
      await stall(media, 20_000);
      expect(screen.getByRole('alert')).toBeTruthy();
      if (i < 3) {
        expect(screen.queryByText('Reference: AD-7K4Q')).toBeNull();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }));
        act(() => controller.retry());
      }
    }
    expect(screen.getByText('Reference: AD-7K4Q')).toBeTruthy();
  });
});
