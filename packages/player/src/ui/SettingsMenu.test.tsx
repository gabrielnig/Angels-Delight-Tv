// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQualityMenu } from '../quality';
import { SettingsMenu, type SettingsMenuProps } from './SettingsMenu';

afterEach(cleanup);

const quality = buildQualityMenu({
  heights: [360, 480, 720],
  selected: 'auto',
  currentHeight: 720,
  dataSaver: false,
  dataSaverMaxHeight: 360,
});

function setup(props: Partial<SettingsMenuProps> = {}) {
  const handlers = {
    onRate: vi.fn(),
    onQuality: vi.fn(),
    onAutoplay: vi.fn(),
    onCaptionStyle: vi.fn(),
    onShortcuts: vi.fn(),
    onClose: vi.fn(),
  };
  const user = userEvent.setup();
  render(<SettingsMenu rate={1} quality={quality} autoplayNext {...handlers} {...props} />);
  return { user, ...handlers };
}

describe('SettingsMenu (L4-07)', () => {
  it('shows speed, quality, autoplay next and caption appearance rows with current values', () => {
    setup({ rate: 1.5 });
    expect(screen.getByRole('menuitem', { name: 'Speed, 1.5x' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Quality, Auto' })).toBeTruthy();
    const autoplay = screen.getByRole('menuitemcheckbox', { name: 'Autoplay next' });
    expect(autoplay.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Caption appearance' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeTruthy();
  });

  it('says Normal for 1x', () => {
    setup();
    expect(screen.getByRole('menuitem', { name: 'Speed, Normal' })).toBeTruthy();
  });

  it('hides the quality row for a single rendition and the caption row without a handler', () => {
    setup({ quality: null, onCaptionStyle: undefined, onShortcuts: undefined });
    expect(screen.queryByRole('menuitem', { name: /^Quality/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Caption appearance' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Keyboard shortcuts' })).toBeNull();
  });

  it('hides the audio row with one track and shows it with several', async () => {
    const onSelect = vi.fn();
    const { user } = setup({
      audio: { current: 'en', tracks: [{ id: 'en', label: 'English' }], onSelect },
    });
    expect(screen.queryByRole('menuitem', { name: /^Audio/ })).toBeNull();
    cleanup();
    const second = setup({
      audio: {
        current: 'en',
        tracks: [
          { id: 'en', label: 'English' },
          { id: 'yo', label: 'Yoruba' },
        ],
        onSelect,
      },
    });
    await second.user.click(screen.getByRole('menuitem', { name: 'Audio, English' }));
    await second.user.click(screen.getByRole('menuitemradio', { name: 'Yoruba' }));
    expect(onSelect).toHaveBeenCalledWith('yo');
    void user;
  });

  it('toggles autoplay next without closing the menu', async () => {
    const { user, onAutoplay, onClose } = setup();
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Autoplay next' }));
    expect(onAutoplay).toHaveBeenCalledWith(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows autoplay next as set by a grown up and ignores the click on a locked profile', async () => {
    const { user, onAutoplay } = setup({ autoplayLocked: true, autoplayNext: false });
    const row = screen.getByRole('menuitemcheckbox', { name: /^Autoplay next/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.getAttribute('aria-label')).toContain('Set by a grown up');
    await user.click(row);
    expect(onAutoplay).not.toHaveBeenCalled();
  });

  it('opens the caption appearance and the keyboard dialog from their rows', async () => {
    const { user, onCaptionStyle, onShortcuts } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'Caption appearance' }));
    expect(onCaptionStyle).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }));
    expect(onShortcuts).toHaveBeenCalledTimes(1);
  });

  describe('submenus', () => {
    it('opens Speed with the current rate marked and applies a choice, then closes', async () => {
      const { user, onRate, onClose } = setup();
      await user.click(screen.getByRole('menuitem', { name: 'Speed, Normal' }));
      const menu = screen.getByRole('menu', { name: 'Speed' });
      expect(
        within(menu).getByRole('menuitemradio', { name: 'Normal' }).getAttribute('aria-checked'),
      ).toBe('true');
      expect(document.activeElement?.textContent).toBe('Normal');
      await user.click(within(menu).getByRole('menuitemradio', { name: '1.5x' }));
      expect(onRate).toHaveBeenCalledWith(1.5);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('moves between rows with the arrow keys', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('menuitem', { name: 'Speed, Normal' }));
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement?.textContent).toBe('1.25x');
      await user.keyboard('{End}');
      expect(document.activeElement?.textContent).toBe('2x');
    });

    it('Escape goes back one level with focus on the row that opened it, then closes', async () => {
      const { user, onClose } = setup();
      const row = screen.getByRole('menuitem', { name: 'Speed, Normal' });
      await user.click(row);
      await user.keyboard('{Escape}');
      expect(screen.getByRole('menu', { name: 'Settings' })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Speed, Normal' }));
      expect(onClose).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('has a Back row in a submenu', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('menuitem', { name: 'Quality, Auto' }));
      await user.click(screen.getByRole('menuitem', { name: 'Back to settings' }));
      expect(screen.getByRole('menu', { name: 'Settings' })).toBeTruthy();
    });

    it('lists the renditions that exist and keeps disabled rungs disabled', async () => {
      const lowData = buildQualityMenu({
        heights: [360, 480, 720],
        selected: 'auto',
        currentHeight: 360,
        dataSaver: true,
        dataSaverMaxHeight: 360,
      });
      const { user, onQuality } = setup({
        quality: lowData,
        dataSaverNote: <p>Data saver is on</p>,
      });
      await user.click(screen.getByRole('menuitem', { name: /^Quality/ }));
      const menu = screen.getByRole('menu', { name: 'Quality' });
      const high = within(menu).getByRole('menuitemradio', { name: /^720p/ });
      expect(high.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(high);
      expect(onQuality).not.toHaveBeenCalled();
      expect(within(menu).getByText('Data saver is on')).toBeTruthy();
    });
  });

  it('renders a chapters section first when given one, for the bottom sheet', () => {
    setup({ chapters: <p>Chapter list</p> });
    const menu = screen.getByRole('menu', { name: 'Settings' });
    expect(menu.firstElementChild?.nextElementSibling?.textContent).toContain('Chapter list');
  });
});
