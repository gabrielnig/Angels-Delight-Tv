import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

const next = { id: 'v2', title: 'Why the Sky Is Blue' };

function stubMedia(compact: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: compact ? q.includes('max-width') : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function setup(view: Partial<PlayerViewProps> = {}, autoplayNext = true) {
  const media = new FakeMedia();
  const onPreferencesChange = vi.fn();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    upNext: next,
    preferences: { autoplayNext },
    onPreferencesChange,
  });
  controller.start();
  act(() => media.setDuration(300));
  const ui = userEvent.setup();
  render(<PlayerView controller={controller} title="Rain" next={next} {...view} />);
  return { media, controller, ui, onPreferencesChange };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PlayerView Settings menu (L4-07)', () => {
  it('replaces the Speed and Quality buttons with one Settings button', () => {
    stubMedia(false);
    setup();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Speed/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quality/ })).toBeNull();
  });

  it('toggling autoplay next updates preferences and the end screen', async () => {
    stubMedia(false);
    const { ui, controller, media, onPreferencesChange } = setup();
    await ui.click(screen.getByRole('button', { name: 'Settings' }));
    await ui.click(screen.getByRole('menuitemcheckbox', { name: 'Autoplay next' }));
    expect(onPreferencesChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoplayNext: false }),
    );
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Autoplay next' }).getAttribute('aria-checked'),
    ).toBe('false');
    act(() => media.finish());
    expect(controller.getState().upNext.countdown).toBeNull();
    expect(screen.getByText('Autoplay is off')).toBeTruthy();
  });

  it('opens the keyboard dialog from its row on desktop', async () => {
    stubMedia(false);
    const { ui } = setup();
    await ui.click(screen.getByRole('button', { name: 'Settings' }));
    await ui.click(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no keyboard shortcuts row on compact screens', async () => {
    stubMedia(true);
    const { ui } = setup();
    await ui.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Autoplay next' })).toBeTruthy();
  });

  it('locks the switch for a kids profile', async () => {
    stubMedia(false);
    const { ui, onPreferencesChange } = setup({ lockAutoplay: true });
    await ui.click(screen.getByRole('button', { name: 'Settings' }));
    const row = screen.getByRole('menuitemcheckbox', { name: /^Autoplay next/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
    expect(onPreferencesChange).not.toHaveBeenCalled();
  });

  it('offers Caption appearance only when captions exist and the host can save it', async () => {
    stubMedia(false);
    const { ui } = setup({ onCaptionStyleChange: vi.fn() });
    await ui.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('menuitem', { name: 'Caption appearance' })).toBeNull();
  });
});
