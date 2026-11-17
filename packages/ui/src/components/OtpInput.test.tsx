import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput, ResendCode } from './OtpInput';

function Controlled({
  onComplete,
  error,
}: {
  onComplete?: (code: string) => void;
  error?: string;
}) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} error={error} />;
}

describe('OtpInput', () => {
  it('is one real numeric one time code input with a group label', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Enter the 6 digit code we sent to your email');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('pattern', '[0-9]*');
    expect(input).toHaveAttribute('maxlength', '6');
  });

  it('draws six presentational slots', () => {
    const { container } = render(<Controlled />);
    expect(container.querySelectorAll('.ad-otp__slot').length).toBe(6);
    expect(container.querySelectorAll('.ad-otp__slot[aria-hidden="true"]').length).toBe(6);
  });

  it('keeps digits only, including pasted text', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText(/6 digit code/);
    await user.click(input);
    await user.paste('12 34-ab56');
    expect(input).toHaveValue('123456');
  });

  it('submits automatically once when full', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onComplete={onComplete} />);
    await user.type(screen.getByLabelText(/6 digit code/), '123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('supports backspace', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByLabelText(/6 digit code/);
    await user.type(input, '123{Backspace}');
    expect(input).toHaveValue('12');
  });

  it('announces an error and marks it invalid', () => {
    render(<Controlled error="That code is not right. Check it and try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent('That code is not right.');
    expect(screen.getByLabelText(/6 digit code/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables input while verifying and shows loading text', () => {
    render(<OtpInput value="123456" onChange={() => {}} loading />);
    expect(screen.getByLabelText(/6 digit code/)).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your code');
  });
});

describe('ResendCode', () => {
  it('counts down and then offers a ghost button', () => {
    vi.useFakeTimers();
    const onResend = vi.fn();
    render(<ResendCode seconds={3} onResend={onResend} />);
    expect(screen.getByText('Send a new code in 0:03')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const button = screen.getByRole('button', { name: 'Send a new code' });
    expect(button).toHaveAttribute('data-variant', 'ghost');
    act(() => {
      button.click();
    });
    expect(onResend).toHaveBeenCalled();
    expect(screen.getByText('Send a new code in 0:03')).toBeInTheDocument();
  });
});
