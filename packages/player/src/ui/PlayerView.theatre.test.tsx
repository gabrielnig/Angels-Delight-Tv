import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

function stubMedia(wide: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width: 960px') ? wide : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function setup(view: Partial<PlayerViewProps> = {}) {
  const media = new FakeMedia();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
  });
  controller.start();
  act(() => media.setDuration(300));
  const onToggle = vi.fn();
  const utils = render(
    <PlayerView controller={controller} title="Rain" onTheatreToggle={onToggle} {...view} />,
  );
  return { onToggle, ...utils };
}

afterEach(() => vi.unstubAllGlobals());

describe('PlayerView theatre mode (M43-S08)', () => {
  it('shows the theatre button on a wide desktop only', () => {
    stubMedia(true);
    const { unmount } = setup();
    expect(screen.getByRole('button', { name: 'Theatre mode' })).toBeTruthy();
    unmount();
    stubMedia(false);
    setup();
    expect(screen.queryByRole('button', { name: /Theatre mode/ })).toBeNull();
  });

  it('hides it without a handler and in full screen', () => {
    stubMedia(true);
    const { unmount } = setup({ onTheatreToggle: undefined });
    expect(screen.queryByRole('button', { name: /Theatre mode/ })).toBeNull();
    unmount();
    const view = setup();
    const region = view.container.querySelector('.adp') as HTMLElement;
    Object.defineProperty(document, 'fullscreenElement', { value: region, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.queryByRole('button', { name: /Theatre mode/ })).toBeNull();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });

  it('T toggles theatre when it is available and does nothing otherwise', () => {
    stubMedia(true);
    const { onToggle, container } = setup();
    fireEvent.keyDown(container.querySelector('.adp')!, { key: 't' });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('T does nothing on a narrow screen', () => {
    stubMedia(false);
    const { onToggle, container } = setup();
    fireEvent.keyDown(container.querySelector('.adp')!, { key: 't' });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('reflects state with aria-pressed and a label that says Exit theatre mode', () => {
    stubMedia(true);
    setup({ theatre: true });
    const button = screen.getByRole('button', { name: 'Exit theatre mode' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls the handler when the button is pressed', () => {
    stubMedia(true);
    const { onToggle } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Theatre mode' }));
    expect(onToggle).toHaveBeenCalled();
  });
});
