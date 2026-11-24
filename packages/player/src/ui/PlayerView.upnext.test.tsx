import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView } from './PlayerView';

const next = { id: 'v2', title: 'Why the Sky Is Blue' };

function setup(streakStart = 0) {
  let streak = streakStart;
  const media = new FakeMedia();
  const onNext = vi.fn();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    upNext: next,
    preferences: { autoplayNext: true },
    onNext,
    autoplayStreak: { get: () => streak, set: (n) => (streak = n) },
  });
  controller.start();
  act(() => media.setDuration(300));
  render(<PlayerView controller={controller} title="Rain" next={next} autoplayNext />);
  return { media, controller, onNext, streak: () => streak };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PlayerView autoplay (L4-08)', () => {
  it('Escape cancels the countdown and announces it', () => {
    const { media, controller } = setup();
    act(() => media.finish());
    expect(controller.getState().upNext.countdown).toBe(5);
    fireEvent.keyDown(screen.getByRole('region', { name: /Video player/ }), { key: 'Escape' });
    expect(controller.getState().upNext).toMatchObject({ countdown: null, cancelled: true });
    expect(controller.getState().announce).toBe('Autoplay cancelled');
  });

  it('a key press or a pointer press resets the unattended streak', () => {
    const { streak } = setup(2);
    const region = screen.getByRole('region', { name: /Video player/ });
    fireEvent.keyDown(region, { key: 'k' });
    expect(streak()).toBe(0);
  });

  it('a pointer press on the surface resets the streak', () => {
    const { streak } = setup(2);
    const region = screen.getByRole('region', { name: /Video player/ });
    const surface = region.querySelector('.adp-surface') ?? region.firstElementChild!;
    fireEvent.pointerDown(surface, { pointerType: 'touch' });
    expect(streak()).toBe(0);
  });

  it('starting an autoplay does not count as input', () => {
    const { media, streak, onNext } = setup(1);
    act(() => media.finish());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onNext).toHaveBeenCalled();
    expect(streak()).toBe(2);
  });

  it('shows Still watching after three unattended autoplays', () => {
    const { media } = setup(3);
    act(() => media.finish());
    expect(screen.getByRole('alertdialog', { name: 'Still watching?' })).toBeTruthy();
    expect(screen.queryByText(/Up next in/)).toBeNull();
  });
});
