// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TwoStepForm } from './TwoStepForm';

const base = { onDone: vi.fn(), supportEmail: 'help@example.org' };

describe('TwoStepForm', () => {
  it('labels one numeric one time code field and asks for the app code first', () => {
    render(<TwoStepForm {...base} onVerify={vi.fn()} onRecover={vi.fn()} />);
    expect(screen.getByLabelText('6 digit code')).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByText(/authenticator app/i)).toBeInTheDocument();
  });

  it('submits on the sixth digit and continues to the next page', async () => {
    const onVerify = vi.fn().mockResolvedValue({ ok: true, next: '/browse' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<TwoStepForm {...base} onDone={onDone} onVerify={onVerify} onRecover={vi.fn()} />);
    await user.type(screen.getByLabelText('6 digit code'), '123456');
    expect(onVerify).toHaveBeenCalledWith('123456');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/browse'));
  });

  it('says the code is not right, keeps the field usable and does not blame', async () => {
    const user = userEvent.setup();
    render(
      <TwoStepForm
        {...base}
        onVerify={vi.fn().mockResolvedValue({ ok: false, reason: 'wrong' })}
        onRecover={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText('6 digit code'), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is not right. Check the time on your phone and try again.',
    );
    expect(screen.getByLabelText('6 digit code')).not.toBeDisabled();
  });

  it('shows the lock with the wait and disables the field', async () => {
    const user = userEvent.setup();
    render(
      <TwoStepForm
        {...base}
        onVerify={vi.fn().mockResolvedValue({ ok: false, reason: 'locked', minutes: 15 })}
        onRecover={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText('6 digit code'), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 15 minutes');
    expect(screen.getByLabelText('6 digit code')).toBeDisabled();
  });

  it('on an expired sign in offers one action: back to sign in', async () => {
    const user = userEvent.setup();
    render(
      <TwoStepForm
        {...base}
        onVerify={vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })}
        onRecover={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText('6 digit code'), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('took too long');
    const link = screen.getByRole('link', { name: 'Back to sign in' });
    expect(link).toHaveAttribute('href', '/sign-in');
  });

  it('switches to a recovery code, submits it and switches back', async () => {
    const onRecover = vi.fn().mockResolvedValue({ ok: true, next: '/profiles' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<TwoStepForm {...base} onDone={onDone} onVerify={vi.fn()} onRecover={onRecover} />);
    await user.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    expect(screen.queryByLabelText('6 digit code')).toBeNull();
    await user.type(screen.getByLabelText('Recovery code'), 'abcde-fghij');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onRecover).toHaveBeenCalledWith('abcde-fghij');
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/profiles'));
  });

  it('keeps focus on a wrong recovery code and shows the matching message', async () => {
    const user = userEvent.setup();
    render(
      <TwoStepForm
        {...base}
        onVerify={vi.fn()}
        onRecover={vi.fn().mockResolvedValue({ ok: false, reason: 'wrong' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Use a recovery code' }));
    await user.type(screen.getByLabelText('Recovery code'), 'zzzzz-zzzzz');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not right or was already used');
    await user.click(screen.getByRole('button', { name: 'Use my authenticator app' }));
    expect(screen.getByLabelText('6 digit code')).toBeInTheDocument();
  });

  it('shows the lost phone line with the support address', () => {
    render(<TwoStepForm {...base} onVerify={vi.fn()} onRecover={vi.fn()} />);
    expect(screen.getByText(/Lost your phone\?/)).toHaveTextContent('help@example.org');
  });
});
