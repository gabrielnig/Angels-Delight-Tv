// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('../../app/actions', () => ({
  requestEmailChangeAction: vi.fn(),
  confirmEmailChangeAction: vi.fn(),
}));

import { EmailCard } from './EmailCard';

describe('EmailCard', () => {
  it('shows the address, the Verified badge, the button and the code note', () => {
    render(<EmailCard email="chinedu.okafor@example.com" verified />);
    expect(screen.getByRole('heading', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByText('chinedu.okafor@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'We will send a 6 digit code to your new address before the change takes effect.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for the new address and password, then the code, then reports done', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, pendingEmail: 'new@example.org' });
    const confirm = vi.fn().mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <EmailCard
        email="a@example.com"
        verified
        request={request}
        confirm={confirm}
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    await user.type(screen.getByLabelText('New email address'), 'new@example.org');
    await user.type(screen.getByLabelText('Your password'), 'pw-123456789');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(request).toHaveBeenCalledWith({ newEmail: 'new@example.org', password: 'pw-123456789' });
    expect(
      await screen.findByText(/We sent a 6 digit code to new@example.org/),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/6 digit code/i), '123456');
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith({ code: '123456' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows the wrong password message and stays on the first step', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, reason: 'wrong_password' });
    const user = userEvent.setup();
    render(<EmailCard email="a@example.com" verified request={request} />);
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    await user.type(screen.getByLabelText('New email address'), 'new@example.org');
    await user.type(screen.getByLabelText('Your password'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Password is not right.')).toBeInTheDocument();
  });
});
