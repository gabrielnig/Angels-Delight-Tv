// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaybackSettingsForm } from './PlaybackSettings';

const initial = {
  autoplayNext: true,
  autoplayPreviews: false,
  dataSaver: true,
  quality: 'auto' as const,
  speed: 1,
  captionsDefault: true,
  captionSize: 'medium' as const,
  captionBackground: 'dark' as const,
  captionContrast: 'standard' as const,
  captionEdge: 'shadow' as const,
  captionLanguage: 'en',
};
const wrap = (save: (p: object) => Promise<unknown>, kids = false) =>
  render(<PlaybackSettingsForm initial={initial} save={save as never} kids={kids} />);

describe('PlaybackSettings state 1: default', () => {
  it('lists the rows with the mockup labels and hints', () => {
    wrap(vi.fn());
    const rows: [string, string][] = [
      ['Autoplay next episode', 'Start the next episode when one ends.'],
      [
        'Autoplay previews on Home',
        'Play a short silent preview when you hover or pause on a title.',
      ],
      [
        'Data saver',
        'Data saver keeps video at 480p or lower to use less data. About 20 MB per minute.',
      ],
      ['Video quality', 'Auto picks the best quality for your network.'],
      ['Default speed', 'You can change speed in the player at any time.'],
      ['Captions on by default', 'Captions are on. You can turn them off in the player.'],
      ['Caption size', 'Applies to all videos.'],
    ];
    for (const [label, hint] of rows) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
    expect(screen.getByText('Caption preview')).toBeInTheDocument();
    expect(screen.getByText('Plants make food using sunlight.')).toBeInTheDocument();
  });

  it('exposes each switch with its label and state', () => {
    wrap(vi.fn());
    expect(screen.getByRole('switch', { name: 'Autoplay next episode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Autoplay previews on Home' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: 'Data saver' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('says captions are off in the hint when they are off', () => {
    render(
      <PlaybackSettingsForm
        initial={{ ...initial, captionsDefault: false }}
        save={vi.fn() as never}
      />,
    );
    expect(
      screen.getByText('Captions are off. You can turn them on in the player.'),
    ).toBeInTheDocument();
  });

  it('offers speed as Normal and multiples', () => {
    wrap(vi.fn());
    const speed = screen.getByRole('combobox', { name: 'Default speed' });
    expect(within(speed).getByRole('option', { name: 'Normal' })).toBeInTheDocument();
    expect(speed).toHaveValue('1');
  });

  it('saves a switch at once and keeps the value', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    const sw = screen.getByRole('switch', { name: 'Autoplay previews on Home' });
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(save).toHaveBeenCalledWith({ autoplayPreviews: true });
  });

  it('saves select changes, speed as a number', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Video quality' }), '720');
    expect(save).toHaveBeenCalledWith({ quality: '720' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Default speed' }), '1.5');
    expect(save).toHaveBeenCalledWith({ speed: 1.5 });
  });

  it('keeps the caption background and high contrast choices', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Caption background' }), 'solid');
    expect(save).toHaveBeenCalledWith({ captionBackground: 'solid' });
    await user.click(screen.getByRole('switch', { name: 'High contrast captions' }));
    expect(save).toHaveBeenCalledWith({ captionContrast: 'high' });
  });

  it('shows and saves the caption edge, and the preview follows it', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    const preview = screen.getByTestId('caption-preview');
    const before = preview.style.getPropertyValue('--adp-cue-edge');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Caption edge' }), 'outline');
    expect(save).toHaveBeenCalledWith({ captionEdge: 'outline' });
    expect(preview.style.getPropertyValue('--adp-cue-edge')).not.toBe(before);
  });

  it('shows a live caption preview that follows the choices', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    const preview = screen.getByTestId('caption-preview');
    expect(preview.style.getPropertyValue('--adp-cap-size')).toBe('20px');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Caption size' }), 'xlarge');
    expect(preview.style.getPropertyValue('--adp-cap-size')).toBe('34px');
  });
});

describe('PlaybackSettings state 2: saved toast', () => {
  it('says Saved after a change and can be dismissed', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    await user.click(screen.getByRole('switch', { name: 'Data saver' }));
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Saved');
    await user.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Saved')).toBeNull();
  });
});

describe('PlaybackSettings state 3: kids profile, locked rows', () => {
  it('explains the lock and disables autoplay next and data saver', async () => {
    const save = vi.fn();
    const user = userEvent.setup();
    wrap(save, true);
    expect(
      screen.getByText('You are in a Kids profile. Some settings are managed by a parent account.'),
    ).toBeInTheDocument();
    const next = screen.getByRole('switch', { name: 'Autoplay next episode' });
    const saver = screen.getByRole('switch', { name: 'Data saver' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(saver).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Set by your parent account.')).toHaveLength(2);
    await user.click(next);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Autoplay previews on Home' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('PlaybackSettings state 5: save error, setting reverted', () => {
  it('puts the setting back, says so and offers Retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    const sw = screen.getByRole('switch', { name: 'Autoplay next episode' });
    await user.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
    expect(
      await screen.findByText('We could not save that change. Your setting was put back.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith({ autoplayNext: false });
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'));
  });
});
