// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DonateForm, type DonateFormProps } from './DonateForm';

afterEach(cleanup);

const props = (over: Partial<DonateFormProps> = {}): DonateFormProps => ({
  currencies: ['NGN'],
  presets: { NGN: [50000, 100000, 200000, 500000], USD: [500, 1000, 2500] },
  limits: { NGN: { min: 20000, max: 500000000 }, USD: { min: 100, max: 5000000 } },
  monthlyEnabled: false,
  orgName: '[Organisation name]',
  testMode: false,
  navigate: vi.fn(),
  ...over,
});
const okFetch = () => vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.paystack.com/abc' }), { status: 200 }));
const fill = async (email = 'chidi@example.com') => {
  await userEvent.type(screen.getByLabelText(/email for your receipt/i), email);
};

describe('DonateForm', () => {
  it('shows presets as buttons with a pressed state and the amount on the submit button', async () => {
    render(<DonateForm {...props({ fetchImpl: okFetch() })} />);
    const five = screen.getByRole('button', { name: '₦500' });
    expect(five).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    expect(screen.getByRole('button', { name: '₦1,000' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^give .*1,000.* once$/i })).toBeInTheDocument();
  });

  it('hides the monthly toggle when monthly giving is off and shows it when on', () => {
    const { rerender } = render(<DonateForm {...props()} />);
    expect(screen.queryByRole('switch', { name: /every month/i })).not.toBeInTheDocument();
    rerender(<DonateForm {...props({ monthlyEnabled: true })} />);
    expect(screen.getByRole('switch', { name: /every month/i })).toBeInTheDocument();
  });

  it('validates a custom amount on blur, then on every change, with the limit in words', async () => {
    render(<DonateForm {...props()} />);
    await userEvent.click(screen.getByRole('button', { name: /other amount/i }));
    const field = screen.getByLabelText(/other amount \(NGN\)/i);
    await userEvent.type(field, '150');
    expect(screen.queryByText(/enter at least/i)).not.toBeInTheDocument();
    fireEvent.blur(field);
    expect(await screen.findByText(/enter at least .*200/i)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(field, '0');
    await waitFor(() => expect(screen.queryByText(/enter at least/i)).not.toBeInTheDocument());
  });

  it('uses a numeric keypad for the amount and email autocomplete for the email', async () => {
    render(<DonateForm {...props()} />);
    await userEvent.click(screen.getByRole('button', { name: /other amount/i }));
    expect(screen.getByLabelText(/other amount \(NGN\)/i)).toHaveAttribute('inputmode', 'numeric');
    const email = screen.getByLabelText(/email for your receipt/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
  });

  it('posts the amount in minor units and sends the browser to the returned url', async () => {
    const fetchImpl = okFetch();
    const navigate = vi.fn();
    render(<DonateForm {...props({ fetchImpl, navigate })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /^give/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://checkout.paystack.com/abc'));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/donate/checkout');
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ amountMinor: 100000, currency: 'NGN', email: 'chidi@example.com', kind: 'one_time' });
    expect(sent.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByText(/taking you to paystack/i)).toBeInTheDocument();
  });

  it('shows a pending state and cannot be submitted twice', async () => {
    let release: (r: Response) => void = () => undefined;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    render(<DonateForm {...props({ fetchImpl: fetchImpl as never })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill();
    const submit = screen.getByRole('button', { name: /^give/i });
    await userEvent.click(submit);
    await userEvent.click(screen.getByRole('button', { name: /taking you|give/i }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /taking you to paystack|give/i })).toHaveAttribute('aria-busy', 'true');
    release(new Response(JSON.stringify({ url: 'https://checkout.paystack.com/x' }), { status: 200 }));
  });

  it('keeps the values and shows the retry message when the network fails', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('offline'); });
    render(<DonateForm {...props({ fetchImpl: fetchImpl as never })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /^give/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(screen.getByLabelText(/email for your receipt/i)).toHaveValue('chidi@example.com');
    expect(screen.getByRole('button', { name: '₦1,000' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^give/i })).not.toBeDisabled();
  });

  it('shows the provider message, nothing charged, and allows another try with a new attempt id', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'provider' }), { status: 502 }));
    render(<DonateForm {...props({ fetchImpl: fetchImpl as never })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /^give/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was charged/i);
  });

  it('maps a rate limit answer to a calm wait message', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }));
    render(<DonateForm {...props({ fetchImpl: fetchImpl as never })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /^give/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a minute/i);
  });

  it('does not send when the email is invalid and focuses the field', async () => {
    const fetchImpl = okFetch();
    render(<DonateForm {...props({ fetchImpl })} />);
    await userEvent.click(screen.getByRole('button', { name: '₦1,000' }));
    await fill('nope');
    await userEvent.click(screen.getByRole('button', { name: /^give/i }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email for your receipt/i)).toHaveFocus();
  });

  it('offers a currency switch only when USD is listed and states the dollar note', async () => {
    const { rerender } = render(<DonateForm {...props()} />);
    expect(screen.queryByRole('group', { name: /currency/i })).not.toBeInTheDocument();
    rerender(<DonateForm {...props({ currencies: ['NGN', 'USD'] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(screen.getByText(/charged in us dollars/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'US$10' })).toBeInTheDocument();
  });

  it('shows the test mode notice and names the organisation', () => {
    render(<DonateForm {...props({ testMode: true })} />);
    expect(screen.getByText(/no real money is taken/i)).toBeInTheDocument();
    expect(screen.getByText(/\[Organisation name\]/)).toBeInTheDocument();
  });

  it('loads no third party script or frame', () => {
    const { container } = render(<DonateForm {...props()} />);
    expect(container.querySelectorAll('script, iframe, img[src^="http"]')).toHaveLength(0);
  });
});
