// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignUpForm } from './SignUpForm';

const scorer = async (pw: string) => (pw.length > 18 ? 4 : 2);

describe('SignUpForm with Turnstile', () => {
  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('sends the token and explains a refused check', async () => {
    let callback: ((token: string) => void) | undefined;
    (window as unknown as { turnstile: unknown }).turnstile = {
      render: (_el: HTMLElement, o: { callback: (t: string) => void }) => {
        callback = o.callback;
        return 'w';
      },
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, reason: 'check_required' });
    const user = userEvent.setup();
    render(
      <SignUpForm onSubmit={onSubmit} onDone={vi.fn()} scorer={scorer} turnstileSiteKey="site" />,
    );
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/security check is still running/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => callback!('t-9'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ challengeToken: 't-9' }));
    expect(await screen.findByText(/could not confirm the security check/)).toBeInTheDocument();
  });
});

describe('SignUpForm', () => {
  it('shows the strength checklist and terms links', () => {
    render(<SignUpForm onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Not a common password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('labels required fields in words', () => {
    render(<SignUpForm onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    expect(screen.getByLabelText(/Email \(required\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password \(required\)/)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });

  it('names the fix for a short password on submit and focuses it', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SignUpForm onSubmit={onSubmit} onDone={vi.fn()} scorer={scorer} />);
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'lagos2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Use at least 10 characters.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Password \(required\)/)).toHaveFocus();
  });

  it('rejects a common password with a plain reason', async () => {
    const user = userEvent.setup();
    render(<SignUpForm onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      screen.getAllByText('That password is too common. Choose another.').length,
    ).toBeGreaterThan(0);
  });

  it('submits and goes to verify email', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, next: '/verify-email' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<SignUpForm onSubmit={onSubmit} onDone={onDone} scorer={scorer} />);
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await waitFor(() => expect(screen.getByText('Strong')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'chioma@example.com',
      password: 'blue mango river sunrise',
      inviteCode: undefined,
    });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/verify-email'));
  });

  it('does not submit when the honeypot is filled and pretends success', async () => {
    const onSubmit = vi.fn();
    const onDone = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <SignUpForm onSubmit={onSubmit} onDone={onDone} scorer={scorer} />,
    );
    const trap = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    await user.type(screen.getByLabelText(/^Email/), 'bot@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await user.type(trap, 'spam');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for an invite code when sign up is invite only', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, next: '/verify-email' });
    const user = userEvent.setup();
    render(<SignUpForm onSubmit={onSubmit} onDone={vi.fn()} scorer={scorer} inviteOnly />);
    expect(screen.getByLabelText(/Invite code \(required\)/)).toBeInTheDocument();
    expect(screen.getByText('Sign up is by invitation for now.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your invite code.')).toBeInTheDocument();
  });

  it('does not mention invitations when sign up is open', () => {
    render(<SignUpForm onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    expect(screen.queryByText('Sign up is by invitation for now.')).not.toBeInTheDocument();
  });

  it('shows a generic message when the invite code is refused', async () => {
    const user = userEvent.setup();
    render(
      <SignUpForm
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'invite_required' })}
        onDone={vi.fn()}
        scorer={scorer}
        inviteOnly
      />,
    );
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await user.type(screen.getByLabelText(/Invite code/), 'ZZZZ-ZZZZ-ZZ');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('That invite code is not valid. Check it and try again.'),
    ).toBeInTheDocument();
  });

  it('keeps values and explains a rate limit', async () => {
    const user = userEvent.setup();
    render(
      <SignUpForm
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'rate_limited' })}
        onDone={vi.fn()}
        scorer={scorer}
      />,
    );
    await user.type(screen.getByLabelText(/^Email/), 'chioma@example.com');
    await user.type(screen.getByLabelText(/^Password \(required\)/), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Too many accounts were created from this connection. Try again in 15 minutes.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveValue('chioma@example.com');
  });
});
