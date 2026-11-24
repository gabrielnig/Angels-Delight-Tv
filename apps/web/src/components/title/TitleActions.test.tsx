// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { TitleActions } from './TitleActions';

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const play = { text: 'Play', href: '/watch/a' };

describe('TitleActions', () => {
  it('offers the primary action as a link and no Start over by default', () => {
    wrap(<TitleActions primary={play} itemKey="video:a" inList={false} toggle={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/watch/a');
    expect(screen.queryByRole('link', { name: 'Start over' })).toBeNull();
  });

  it('shows Resume with Start over when a start over link is given', () => {
    wrap(
      <TitleActions
        primary={{ text: 'Resume from 2:14', href: '/watch/a', startOverHref: '/watch/a?t=0' }}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Resume from 2:14' })).toHaveAttribute(
      'href',
      '/watch/a',
    );
    expect(screen.getByRole('link', { name: 'Start over' })).toHaveAttribute(
      'href',
      '/watch/a?t=0',
    );
  });

  it('toggles My List optimistically with aria-pressed and says so', async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    wrap(<TitleActions primary={play} itemKey="video:a" inList={false} toggle={toggle} />);
    const button = screen.getByRole('button', { name: /My List/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveBeenCalledWith('video:a', true);
    expect(await screen.findByText('Added to My List')).toBeInTheDocument();
  });

  it('rolls back and says so when saving fails', async () => {
    const toggle = vi.fn().mockRejectedValue(new Error('no'));
    wrap(<TitleActions primary={play} itemKey="video:a" inList={false} toggle={toggle} />);
    const button = screen.getByRole('button', { name: /My List/ });
    await userEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(await screen.findByText(/could not update My List/i)).toBeInTheDocument();
  });

  it('shares with the Web Share API when it exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    wrap(
      <TitleActions
        primary={play}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
        shareTitle="Rivers"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rivers' }));
    Object.assign(navigator, { share: undefined });
  });

  it('opens the share menu where there is no native share, and Copy link shows a toast (M45-S06)', async () => {
    Object.assign(navigator, { share: undefined });
    wrap(
      <TitleActions
        primary={play}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
        shareTitle="Rivers"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('has no Share button on a kids profile (M45-S06 AC4)', () => {
    wrap(
      <TitleActions
        primary={play}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
        shareTitle="Rivers"
        kids
      />,
    );
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('lists the channels the admin chose and shares the configured text', async () => {
    Object.assign(navigator, { share: undefined });
    wrap(
      <TitleActions
        primary={play}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
        shareTitle="Rivers"
        share={{ channels: ['x', 'email'], text: 'Rivers on ADTV' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email/ })).toBeInTheDocument();
  });

  it('says the change was saved on this device when it was queued offline', async () => {
    const toggle = vi.fn().mockResolvedValue('queued');
    wrap(<TitleActions primary={play} itemKey="video:a" inList={false} toggle={toggle} />);
    await userEvent.click(screen.getByRole('button', { name: /My List/ }));
    expect(
      await screen.findByText('Saved on this device. It will sync when you are back online.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My List/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('TitleActions in the title layout (S18)', () => {
  const resume = {
    text: 'Resume, 3 min 38 sec left',
    href: '/watch/a',
    startOverHref: '/watch/a?t=0',
  };

  it('puts Play and Start over on one row and My List and Share on the next', () => {
    const { container } = wrap(
      <TitleActions
        layout="title"
        primary={resume}
        itemKey="video:a"
        inList
        shareTitle="T"
        toggle={vi.fn()}
      />,
    );
    const rows = container.querySelectorAll('.tv-actions__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelectorAll('a')).toHaveLength(2);
    expect(rows[1]!.querySelectorAll('button')).toHaveLength(2);
  });

  it('says In My List when the title is saved and keeps the pressed state', () => {
    wrap(
      <TitleActions layout="title" primary={resume} itemKey="video:a" inList toggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'In My List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('says My List when it is not saved', () => {
    wrap(
      <TitleActions
        layout="title"
        primary={resume}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'My List' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks the first row so phones can hide it behind the sticky Play bar', () => {
    const { container } = wrap(
      <TitleActions
        layout="title"
        primary={resume}
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
      />,
    );
    expect(container.querySelector('.tv-actions__row--play')).not.toBeNull();
  });

  describe('guest', () => {
    const guest = { signUpOpen: true, next: '/title/a' };

    it('opens the Sign in to save dialog instead of toggling, with no pressed state', async () => {
      const toggle = vi.fn();
      wrap(
        <TitleActions
          primary={play}
          itemKey="video:a"
          inList={false}
          toggle={toggle}
          guest={guest}
        />,
      );
      const button = screen.getByRole('button', { name: /My List/ });
      expect(button).not.toHaveAttribute('aria-pressed');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      await userEvent.click(button);
      expect(screen.getByRole('dialog', { name: 'Save this to My List' })).toBeInTheDocument();
      expect(toggle).not.toHaveBeenCalled();
    });

    it('returns focus to the button when the dialog closes', async () => {
      wrap(<TitleActions primary={play} itemKey="video:a" inList={false} guest={guest} />);
      const button = screen.getByRole('button', { name: /My List/ });
      await userEvent.click(button);
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(button).toHaveFocus();
    });
  });
});
