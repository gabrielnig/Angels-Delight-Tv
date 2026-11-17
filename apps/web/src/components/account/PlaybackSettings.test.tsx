// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { PlaybackSettingsForm } from './PlaybackSettings';

const initial = {
  autoplayNext: true,
  dataSaver: false,
  quality: 'auto' as const,
  speed: 1,
  captionsDefault: false,
  captionSize: 'medium' as const,
};
const wrap = (save: (p: object) => Promise<unknown>) =>
  render(
    <ToastProvider>
      <PlaybackSettingsForm initial={initial} save={save as never} />
    </ToastProvider>,
  );

describe('PlaybackSettingsForm', () => {
  it('saves a switch immediately and keeps the new value', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    const sw = screen.getByRole('switch', { name: /Data saver/ });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(save).toHaveBeenCalledWith({ dataSaver: true });
  });

  it('rolls the switch back and says so when saving fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    wrap(save);
    const sw = screen.getByRole('switch', { name: /Autoplay next/ });
    await user.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'));
    expect(
      await screen.findByText('We could not save that. Your setting was not changed.'),
    ).toBeInTheDocument();
  });

  it('saves select changes', async () => {
    const save = vi.fn().mockResolvedValue(initial);
    const user = userEvent.setup();
    wrap(save);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Video quality' }), '720');
    expect(save).toHaveBeenCalledWith({ quality: '720' });
  });
});
