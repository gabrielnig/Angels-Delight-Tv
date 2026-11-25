// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@ad/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareMenu } from './ShareMenu';
import type { ShareChannelId } from './share-links';

const props = {
  title: 'Rivers',
  text: 'Rivers on ADTV',
  channels: ['whatsapp', 'facebook', 'x'] as ShareChannelId[],
  kind: 'video' as const,
};

function setup(over: Partial<React.ComponentProps<typeof ShareMenu>> = {}) {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ShareMenu {...props} {...over} />
    </ToastProvider>,
  );
  return { user };
}

afterEach(() => {
  Object.assign(navigator, { share: undefined });
  vi.restoreAllMocks();
});

describe('ShareMenu (M45-S06)', () => {
  it('uses native share when available and opens no menu', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Rivers',
        text: 'Rivers on ADTV',
        url: expect.stringContaining('s=nt'),
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores AbortError from a cancelled native share', async () => {
    Object.assign(navigator, {
      share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
    });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('falls back to the link field when native share fails', async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error('boom')) });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('textbox', { name: 'Link to share' })).toBeInTheDocument();
  });

  it('shows copy first, then whatsapp, facebook and x when native share is missing', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    const dialog = screen.getByRole('dialog', { name: 'Share this video' });
    const names = within(dialog)
      .getAllByRole('link')
      .map((el) => el.textContent);
    expect(within(dialog).getAllByRole('button')[0]).toHaveTextContent('Copy link');
    expect(names[0]).toContain('WhatsApp');
    expect(names.join(' ')).toContain('Facebook');
    expect(names.join(' ')).toContain('X');
    expect(names.join(' ')).not.toContain('Email');
  });

  it('lists Email only when the admin enabled it', async () => {
    const { user } = setup({ channels: ['whatsapp', 'email'] });
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('link', { name: /Email/ })).toBeInTheDocument();
  });

  it('says Share this series for a series', async () => {
    const { user } = setup({ kind: 'series' });
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'Share this series' })).toBeInTheDocument();
  });

  it('external links open in a new tab and say so to screen readers', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    const link = screen.getByRole('link', { name: /WhatsApp/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/'));
    expect(within(link).getByText('Opens in a new tab')).toBeInTheDocument();
  });

  it('copy shows a Link copied toast and closes the menu', async () => {
    const { user } = setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('s=cp'));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('falls back to a selectable field when the clipboard is blocked', async () => {
    const { user } = setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true,
    });
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    const field = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Link to share' });
    expect(field.value).not.toContain('s=cp');
  });

  it('closes on Escape and returns focus to the button', async () => {
    const { user } = setup();
    const trigger = screen.getByRole('button', { name: 'Share' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('moves focus into the menu when it opens', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus();
  });
});
