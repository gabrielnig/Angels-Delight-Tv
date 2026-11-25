// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackShare } from './share-analytics';
import { ShareSheet, type ShareSheetProps } from './ShareSheet';

vi.mock('./share-analytics', () => ({ trackShare: vi.fn() }));

const url = 'https://adtv.example/title/rivers';
const base: ShareSheetProps = {
  open: true,
  onClose: () => {},
  title: 'How rivers form',
  text: 'How rivers form on Angels Delight TV',
  url,
  kind: 'video',
  channels: ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'],
};

function setup(over: Partial<ShareSheetProps> = {}, clip: unknown = undefined) {
  const props = { ...base, onClose: vi.fn(), onShare: vi.fn(), ...over };
  const user = userEvent.setup();
  setClip(clip);
  const view = render(<ShareSheet {...props} />);
  return { user, props, view };
}

function setClip(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}
const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });

afterEach(() => {
  cleanup();
  Object.assign(navigator, { share: undefined });
  setClip(undefined);
  setOnline(true);
  Reflect.deleteProperty(document, 'execCommand');
  vi.restoreAllMocks();
});

describe('ShareSheet (L15a slice 2)', () => {
  it('renders nothing when closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog that says what is shared', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Share this video' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('How rivers form')).toBeInTheDocument();
  });

  it('says Share this series for a series', () => {
    setup({ kind: 'series' });
    expect(screen.getByRole('dialog', { name: 'Share this series' })).toBeInTheDocument();
  });

  it('lists Copy link and the channels in the admin order, with More last when the device can share', () => {
    Object.assign(navigator, { share: vi.fn() });
    setup();
    const names = screen.getAllByTestId('share-target').map((el) => el.textContent?.replace('Opens in a new tab', ''));
    expect(names).toEqual([
      'Copy link', 'WhatsApp', 'Facebook', 'X', 'Telegram', 'Email', 'Messages', 'More',
    ]);
  });

  it('hides More without a device share menu and follows a shorter admin list', async () => {
    setup({ channels: ['telegram', 'whatsapp'] });
    await waitFor(() => expect(screen.getAllByTestId('share-target')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('opens web channels in a new tab with a clean link, and mail and SMS in place', () => {
    setup();
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    expect(wa).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(url)));
    expect(wa).toHaveAttribute('target', '_blank');
    expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(wa).getByText('Opens in a new tab')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email/ })).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: /Messages/ }).getAttribute('href')).toMatch(/^sms:/);
    for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).not.toContain('s%3D');
  });

  it('shows the link in a readonly field', () => {
    setup();
    const field = screen.getByLabelText('Link to share');
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveValue(url);
  });

  it('copies the link, says so politely and keeps the sheet open', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user, props } = setup({}, { writeText });
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalledWith('copy');
  });

  it('the Copy button next to the field does the same', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user } = setup({}, { writeText });
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it('falls back to the selection copy command when the clipboard api is missing', async () => {
    const exec = vi.fn().mockReturnValue(true);
    Object.assign(document, { execCommand: exec });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
  });

  it('when nothing can copy, selects the field and says what to do', async () => {
    Object.assign(document, { execCommand: vi.fn().mockReturnValue(false) });
    const { user } = setup({}, { writeText: vi.fn().mockRejectedValue(new Error('no')) });
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not copy. Press and hold the link, then choose Copy.',
    );
    expect(screen.getByLabelText('Link to share')).toHaveFocus();
  });

  it('More opens the device share menu with the clean link', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(share).toHaveBeenCalledWith({ title: 'How rivers form', text: base.text, url });
    expect(props.onShare).toHaveBeenCalledWith('more');
  });

  it('ignores a cancelled device share and shows a sentence for a real failure', async () => {
    const abort = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    Object.assign(navigator, { share: abort });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('status')).toHaveTextContent('');
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error('boom')) });
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'We could not open your share menu. Copy the link below instead.',
    );
  });

  it('reports each web channel once when it is chosen and closes', async () => {
    const { user, props } = setup();
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    wa.addEventListener('click', (e) => e.preventDefault());
    await user.click(wa);
    expect(props.onShare).toHaveBeenCalledWith('whatsapp');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('offline: web channels explain themselves and do not leave, Copy link and Messages still work', async () => {
    setOnline(false);
    const { user, props } = setup();
    expect(screen.getByRole('link', { name: /Messages/ })).toBeInTheDocument();
    const wa = screen.getByRole('button', { name: /WhatsApp/ });
    expect(wa).toHaveAttribute('aria-disabled', 'true');
    await user.click(wa);
    expect(screen.getByRole('status')).toHaveTextContent('You are offline. Connect to share with WhatsApp.');
    expect(props.onShare).not.toHaveBeenCalled();
  });

  it('Escape, the close button and the scrim close it', async () => {
    const { user, props } = setup();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByTestId('share-scrim'));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus in, keeps Tab inside and gives focus back', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { user, view } = setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 20; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    view.rerender(<ShareSheet {...base} open={false} />);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('swiping down on the handle past the limit closes it, a short drag does not', () => {
    const { props } = setup();
    const grab = screen.getByTestId('share-grab');
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 130, pointerId: 1 });
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(grab, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(grab, { clientY: 320, pointerId: 1 });
    fireEvent.pointerUp(grab, { clientY: 320, pointerId: 1 });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('is a sheet under 600 px and a popover from 600 px', () => {
    const mq = (matches: boolean) =>
      vi.fn().mockReturnValue({ matches, addEventListener: () => {}, removeEventListener: () => {} });
    window.matchMedia = mq(false) as never;
    const first = setup();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-mode', 'sheet');
    first.view.unmount();
    window.matchMedia = mq(true) as never;
    setup();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-mode', 'popover');
  });

  it('every target is a real link or button with a text label', () => {
    setup();
    for (const el of screen.getAllByTestId('share-target')) {
      expect((el.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('counts each chosen place once, anonymously, and not a failed copy or an offline tap (L15a slice 4)', async () => {
    vi.mocked(trackShare).mockClear();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const first = setup({ kind: 'series' }, { writeText });
    await first.user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(trackShare).toHaveBeenCalledWith('copy', 'series', undefined);
    const wa = screen.getByRole('link', { name: /WhatsApp/ });
    wa.addEventListener('click', (e) => e.preventDefault());
    await first.user.click(wa);
    expect(trackShare).toHaveBeenCalledWith('whatsapp', 'series', undefined);
    expect(trackShare).toHaveBeenCalledTimes(2);
    first.view.unmount();

    vi.mocked(trackShare).mockClear();
    Object.assign(document, { execCommand: vi.fn().mockReturnValue(false) });
    const failing = setup({}, { writeText: vi.fn().mockRejectedValue(new Error('no')) });
    await failing.user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(trackShare).not.toHaveBeenCalled();
    failing.view.unmount();

    setOnline(false);
    const offline = setup();
    await offline.user.click(screen.getByRole('button', { name: /WhatsApp/ }));
    expect(trackShare).not.toHaveBeenCalled();
    offline.view.unmount();
    setOnline(true);

    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const more = setup();
    await more.user.click(screen.getByRole('button', { name: 'More' }));
    expect(trackShare).toHaveBeenCalledWith('more', 'video', undefined);
  });
});
