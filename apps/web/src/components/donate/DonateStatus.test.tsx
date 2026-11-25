// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DonateStatus } from './DonateStatus';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const REF = 'ad-don-abcdefghij0123456789';
const answer = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const base = { reference: REF, token: 'tok', title: 'Thank you', body: 'Your gift has been received.', supportEmail: 'help@example.org', pollMs: 5, maxPolls: 3 };

describe('DonateStatus', () => {
  it('shows success only when the server says succeeded, with details from the answer', async () => {
    const fetchImpl = vi.fn(async () => answer({ status: 'succeeded', reference: REF, amountMinor: 100000, currency: 'NGN', kind: 'one_time' }));
    render(<DonateStatus {...base} fetchImpl={fetchImpl as never} />);
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.getByText('₦1,000')).toBeInTheDocument();
    expect(screen.getByText(REF)).toBeInTheDocument();
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe(`/api/donate/status?reference=${REF}&t=tok`);
  });

  it('shows nothing personal when the answer carries no details (no valid token)', async () => {
    const fetchImpl = vi.fn(async () => answer({ status: 'succeeded' }));
    render(<DonateStatus {...base} fetchImpl={fetchImpl as never} />);
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.queryByText(REF)).not.toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('shows confirming for processing, polls up to the limit, then offers Check again', async () => {
    const fetchImpl = vi.fn(async () => answer({ status: 'processing' }));
    render(<DonateStatus {...base} fetchImpl={fetchImpl as never} />);
    expect(await screen.findByRole('heading', { name: /confirming your gift/i })).toBeInTheDocument();
    await waitFor(() => expect(fetchImpl.mock.calls.length).toBe(4));
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchImpl.mock.calls.length).toBe(4);
    const check = screen.getByRole('button', { name: /check again/i });
    await userEvent.click(check);
    await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThan(4));
  });

  it('turns into success when a later poll says succeeded', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(answer({ status: 'processing' }))
      .mockResolvedValue(answer({ status: 'succeeded', reference: REF, amountMinor: 50000, currency: 'NGN', kind: 'one_time' }));
    render(<DonateStatus {...base} fetchImpl={fetchImpl as never} />);
    expect(await screen.findByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
  });

  it('shows failed with one Try again link to /donate', async () => {
    render(<DonateStatus {...base} fetchImpl={(async () => answer({ status: 'failed' })) as never} />);
    expect(await screen.findByRole('heading', { name: /did not go through/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/donate');
  });

  it('shows cancelled with Give again and Back to Home', async () => {
    render(<DonateStatus {...base} fetchImpl={(async () => answer({ status: 'cancelled' })) as never} />);
    expect(await screen.findByRole('heading', { name: /you cancelled this gift/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /give again/i })).toHaveAttribute('href', '/donate');
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/');
  });

  it('shows a calm unknown state with the support email on 404, never success', async () => {
    render(<DonateStatus {...base} fetchImpl={(async () => answer({ error: 'not_found' }, 404)) as never} />);
    expect(await screen.findByRole('heading', { name: /could not find this gift/i })).toBeInTheDocument();
    expect(screen.getByText(/help@example.org/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
  });

  it('keeps saying confirming when the request fails, and announces changes politely', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('offline'); });
    render(<DonateStatus {...base} fetchImpl={fetchImpl as never} />);
    expect(await screen.findByRole('heading', { name: /confirming your gift/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('ignores any status in the page address: only the server answer counts', async () => {
    window.history.pushState({}, '', '/donate/thank-you?status=succeeded&reference=' + REF);
    render(<DonateStatus {...base} fetchImpl={(async () => answer({ status: 'processing' })) as never} />);
    expect(await screen.findByRole('heading', { name: /confirming your gift/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
  });
});
