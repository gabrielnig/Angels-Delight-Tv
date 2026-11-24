// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const path = vi.hoisted(() => ({ value: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.value }));

import { NOTICE_KEY } from '../../lib/consent/notice';
import { StorageNotice } from './StorageNotice';

const props = { enabled: true, text: 'We keep a few small files on your device.', version: 1 };

beforeEach(() => {
  window.localStorage.clear();
  path.value = '/';
  document.documentElement.style.removeProperty('--notice-h');
});
afterEach(() => vi.restoreAllMocks());

describe('StorageNotice (M45-S11)', () => {
  it('shows the configured text, a privacy link and one Got it button', async () => {
    render(<StorageNotice {...props} />);
    const region = await screen.findByRole('region', { name: 'Storage notice' });
    expect(region).toHaveTextContent('We keep a few small files on your device.');
    const link = screen.getByRole('link', { name: 'How we use storage' });
    expect(link).toHaveAttribute('href', '/privacy#storage');
    expect(screen.getByRole('button', { name: 'Got it' }).tagName).toBe('BUTTON');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('has no reject, accept all or settings controls', async () => {
    render(<StorageNotice {...props} />);
    await screen.findByRole('region');
    expect(screen.queryByRole('button', { name: /reject|accept|settings|manage|decline/i })).toBeNull();
  });

  it('Got it closes it and remembers the version for next time', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<StorageNotice {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(NOTICE_KEY)!)).toMatchObject({ version: 1 });
    unmount();
    render(<StorageNotice {...props} />);
    await act(async () => {});
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('comes back when the version is raised', async () => {
    window.localStorage.setItem(NOTICE_KEY, JSON.stringify({ version: 1, at: Date.now() }));
    render(<StorageNotice {...props} version={2} />);
    expect(await screen.findByRole('region')).toBeInTheDocument();
  });

  it('renders nothing when disabled in settings', async () => {
    render(<StorageNotice {...props} enabled={false} />);
    await act(async () => {});
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('is never shown on a watch page and returns on other pages', async () => {
    path.value = '/watch/abc';
    const { rerender } = render(<StorageNotice {...props} />);
    await act(async () => {});
    expect(screen.queryByRole('region')).toBeNull();
    path.value = '/browse';
    rerender(<StorageNotice {...props} />);
    expect(await screen.findByRole('region')).toBeInTheDocument();
  });

  it('does not take focus and does not trap it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <StorageNotice {...props} />
        <button type="button">After</button>
      </>,
    );
    await screen.findByRole('region');
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'How we use storage' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    const region = screen.getByRole('region');
    expect(region).not.toHaveAttribute('aria-modal');
    expect(region).not.toHaveAttribute('role', 'dialog');
  });

  it('is a labelled region that is not a live alert and carries the overlay layer marker', async () => {
    render(<StorageNotice {...props} />);
    const region = await screen.findByRole('region', { name: 'Storage notice' });
    expect(region).not.toHaveAttribute('aria-live', 'assertive');
    expect(region).toHaveClass('ad-notice');
  });

  it('shows on every visit and never errors when storage is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<StorageNotice {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('publishes its height as --notice-h while shown and resets it to 0 when hidden', async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 96,
    } as DOMRect);
    render(<StorageNotice {...props} />);
    await screen.findByRole('region');
    expect(document.documentElement.style.getPropertyValue('--notice-h')).toBe('96px');
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(document.documentElement.style.getPropertyValue('--notice-h')).toBe('0px');
  });
});
