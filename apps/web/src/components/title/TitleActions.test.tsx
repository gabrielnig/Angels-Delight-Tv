// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { TitleActions } from './TitleActions';

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('TitleActions', () => {
  it('offers Play linking to the watch page when nothing is in progress', () => {
    wrap(<TitleActions watchHref="/watch/a" itemKey="video:a" inList={false} toggle={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/watch/a');
    expect(screen.queryByRole('link', { name: 'Start over' })).toBeNull();
  });

  it('offers Continue with time left and Start over when in progress', () => {
    wrap(
      <TitleActions
        watchHref="/watch/a"
        itemKey="video:a"
        inList={false}
        toggle={vi.fn()}
        resume={{ timeLeft: '3 min left' }}
      />,
    );
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAccessibleName(/3 min left/);
    expect(screen.getByRole('link', { name: 'Start over' })).toHaveAttribute(
      'href',
      '/watch/a?start=0',
    );
  });

  it('toggles My List optimistically with aria-pressed', async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    wrap(<TitleActions watchHref="/watch/a" itemKey="video:a" inList={false} toggle={toggle} />);
    const button = screen.getByRole('button', { name: 'My List' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveBeenCalledWith('video:a', true);
  });

  it('rolls back and says so when saving fails', async () => {
    const toggle = vi.fn().mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    wrap(<TitleActions watchHref="/watch/a" itemKey="video:a" inList={false} toggle={toggle} />);
    await user.click(screen.getByRole('button', { name: 'My List' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'My List' })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(await screen.findByText('We could not update My List. Try again.')).toBeInTheDocument();
  });
});
