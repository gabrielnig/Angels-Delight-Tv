// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareButton, type ShareButtonProps } from './ShareButton';

const props: ShareButtonProps = {
  title: 'Rivers',
  text: 'Rivers on ADTV',
  channels: ['whatsapp', 'x'],
  kind: 'video',
  url: 'https://adtv.example/title/rivers',
};

afterEach(() => {
  cleanup();
  Object.assign(navigator, { share: undefined });
});

describe('ShareButton (L15a slice 2)', () => {
  it('opens our sheet even when the device has a share menu, and More reaches the device menu', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const user = userEvent.setup();
    render(<ShareButton {...props} />);
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Share this video' })).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(share).toHaveBeenCalledWith({
      title: 'Rivers',
      text: 'Rivers on ADTV',
      url: 'https://adtv.example/title/rivers',
    });
  });

  it('closes and gives focus back to the button', async () => {
    const user = userEvent.setup();
    render(<ShareButton {...props} />);
    const button = screen.getByRole('button', { name: 'Share' });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('turns a path into an address on this site and never keeps the query or hash of the page', async () => {
    window.history.replaceState(null, '', '/watch/abc?t=99&token=secret#x');
    const user = userEvent.setup();
    render(<ShareButton {...props} url="/title/rivers" />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByLabelText('Link to share')).toHaveValue(`${window.location.origin}/title/rivers`);
  });

  it('without a url it falls back to this page without query or hash', async () => {
    window.history.replaceState(null, '', '/title/rivers?utm_source=x&s=wa#top');
    const user = userEvent.setup();
    const { url: _drop, ...rest } = props;
    render(<ShareButton {...rest} />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByLabelText('Link to share')).toHaveValue(`${window.location.origin}/title/rivers`);
  });

  it('the icon variant is a 44 px named button for cards and the hero', () => {
    render(<ShareButton {...props} variant="icon" />);
    expect(screen.getByRole('button', { name: 'Share Rivers' })).toBeInTheDocument();
  });

  it('says Share this series for a series', async () => {
    const user = userEvent.setup();
    render(<ShareButton {...props} kind="series" />);
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'Share this series' })).toBeInTheDocument();
  });
});
