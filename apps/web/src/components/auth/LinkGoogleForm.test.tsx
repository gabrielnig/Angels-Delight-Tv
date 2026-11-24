// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LinkGoogleForm } from './LinkGoogleForm';

const base = { hint: 'c***@gmail.com', onDone: vi.fn() };

describe('LinkGoogleForm', () => {
  it('names the account by its masked address and asks for the password once', () => {
    render(<LinkGoogleForm {...base} onConfirm={vi.fn()} />);
    expect(
      screen.getByRole('heading', { name: 'Link Google to your account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('c***@gmail.com')).toBeInTheDocument();
    expect(screen.getByLabelText('Account password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Account password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('links and continues on the right password', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ok: true, next: '/library' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<LinkGoogleForm {...base} onDone={onDone} onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText('Account password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Link Google' }));
    expect(onConfirm).toHaveBeenCalledWith('correct horse battery');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/library'));
  });

  it('wrong password error keeps the field and does not continue', async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(
      <LinkGoogleForm
        {...base}
        onDone={onDone}
        onConfirm={vi.fn().mockResolvedValue({ ok: false, reason: 'wrong' })}
      />,
    );
    await user.type(screen.getByLabelText('Account password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Link Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That password is not right. Try again.',
    );
    expect(screen.getByLabelText('Account password')).not.toBeDisabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows the lockout copy with the wait and disables the form', async () => {
    const user = userEvent.setup();
    render(
      <LinkGoogleForm
        {...base}
        onConfirm={vi.fn().mockResolvedValue({ ok: false, reason: 'locked', minutes: 12 })}
      />,
    );
    await user.type(screen.getByLabelText('Account password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Link Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 12 minutes.',
    );
    expect(screen.getByLabelText('Account password')).toBeDisabled();
  });

  it('an expired note sends the person back to sign in', async () => {
    const user = userEvent.setup();
    render(
      <LinkGoogleForm
        {...base}
        onConfirm={vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })}
      />,
    );
    await user.type(screen.getByLabelText('Account password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Link Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This took too long');
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('offers cancel and forgot password as links', () => {
    render(<LinkGoogleForm {...base} onConfirm={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
