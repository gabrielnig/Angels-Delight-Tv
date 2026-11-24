// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/TurnstileWidget', () => ({
  TurnstileWidget: ({
    siteKey,
    onToken,
  }: {
    siteKey: string;
    onToken: (t: string | null) => void;
  }) => <button onClick={() => onToken('token-1')}>widget {siteKey}</button>,
}));

import { GuestChallenge } from './GuestChallenge';

describe('GuestChallenge (S89)', () => {
  it('asks for one quick check and hands the token back', async () => {
    const onToken = vi.fn();
    render(<GuestChallenge open siteKey="site-1" onToken={onToken} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'One quick check' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'widget site-1' }));
    expect(onToken).toHaveBeenCalledWith('token-1');
  });

  it('has a single action, Cancel, which gives no token', async () => {
    const onCancel = vi.fn();
    render(<GuestChallenge open siteKey="site-1" onToken={vi.fn()} onCancel={onCancel} />);
    const buttons = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.startsWith('widget'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel']);
    await userEvent.click(buttons[0]!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(<GuestChallenge open={false} siteKey="s" onToken={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
