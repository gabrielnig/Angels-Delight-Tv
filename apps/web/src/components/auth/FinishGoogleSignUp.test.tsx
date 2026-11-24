// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FinishGoogleSignUp } from './FinishGoogleSignUp';

const base = { hint: 'c***@gmail.com', onDone: vi.fn() };

describe('FinishGoogleSignUp', () => {
  it('shows the masked address and the consent statement with the button', () => {
    render(<FinishGoogleSignUp {...base} onFinish={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Finish setting up' })).toBeInTheDocument();
    expect(screen.getByText(/c\*\*\*@gmail\.com/)).toBeInTheDocument();
    expect(
      screen.getByText(/By continuing you agree to the Terms and Privacy Policy/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/sign-in');
  });

  it('creates the account and continues', async () => {
    const onFinish = vi.fn().mockResolvedValue({ ok: true, next: '/profiles' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<FinishGoogleSignUp {...base} onDone={onDone} onFinish={onFinish} />);
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/profiles'));
  });

  it('shows the expired message with a way back, and a retry on a network failure', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FinishGoogleSignUp
        {...base}
        onFinish={vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This took too long');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeInTheDocument();
    rerender(
      <FinishGoogleSignUp
        {...base}
        onFinish={vi.fn().mockResolvedValue({ ok: false, reason: 'network' })}
      />,
    );
  });
});
