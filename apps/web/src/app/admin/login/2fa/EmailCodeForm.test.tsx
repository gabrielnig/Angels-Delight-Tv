// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailCodeForm } from './EmailCodeForm';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const verify = vi.fn(async () => ({}));

function mount(overrides: Partial<Parameters<typeof EmailCodeForm>[0]> = {}) {
  const resend = vi.fn(async () => ({ sent: true, wait: 60 }));
  render(
    <EmailCodeForm next="/admin" sent canRemember verify={verify} resend={resend} {...overrides} />,
  );
  return { resend };
}

describe('EmailCodeForm', () => {
  it('has a numeric one time code input with a visible label', () => {
    mount();
    const input = screen.getByLabelText('6 digit code') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('maxlength')).toBe('6');
    expect(input.getAttribute('name')).toBe('code');
  });

  it('offers Remember this device, ticked by default, and leaves it out when the site turned it off', () => {
    mount();
    expect((screen.getByLabelText('Remember this device for 30 days') as HTMLInputElement).checked).toBe(true);
    cleanup();
    mount({ canRemember: false });
    expect(screen.queryByLabelText(/Remember this device/)).toBeNull();
  });

  it('shows a cooldown on the resend button and a countdown that ends', async () => {
    mount();
    const button = screen.getByRole('button', { name: /Send a new code/ });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/another code in 60 seconds/)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole('button', { name: 'Send a new code' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('asks for a new code, announces it and starts the wait again', async () => {
    const { resend } = mount();
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    });
    expect(resend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('A new code is on its way');
    expect(screen.getByText(/another code in 60 seconds/)).toBeTruthy();
  });

  it('says plainly when the first mail could not be sent and lets the person ask at once', () => {
    mount({ sent: false });
    expect(screen.getByRole('alert').textContent).toContain('We could not send the code');
    expect(screen.getByRole('button', { name: 'Send a new code' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('shows a resend problem with its wait, one action only', async () => {
    const resend = vi.fn(async () => ({ error: 'Too many requests', wait: 40 }));
    mount({ sent: false, resend });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    });
    expect(screen.getByText(/another code in 40 seconds/)).toBeTruthy();
  });
});
