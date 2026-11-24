// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WatchActions } from './WatchActions';

describe('WatchActions for a guest', () => {
  it('opens the Sign in to save dialog and saves nothing', async () => {
    const onToggle = vi.fn();
    render(
      <WatchActions
        videoId="v1"
        title="Rain"
        initialInMyList={false}
        onToggleMyList={onToggle}
        guest={{ signUpOpen: true }}
      />,
    );
    const button = screen.getByRole('button', { name: /My List/ });
    expect(button).not.toHaveAttribute('aria-pressed');
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Save this to My List' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent('/watch/v1')}`,
    );
    expect(onToggle).not.toHaveBeenCalled();
  });
});
