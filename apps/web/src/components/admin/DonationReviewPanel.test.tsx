// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DonationReviewPanel } from './DonationReviewPanel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('./Toast', () => ({ useToast: () => ({ show: vi.fn() }) }));
afterEach(cleanup);

const base = { id: 'd1', canResolve: true, inReview: true };

describe('DonationReviewPanel', () => {
  it('keeps both buttons off with a reason until a note is written, then resolves with the note', async () => {
    const resolve = vi.fn(async () => ({ ok: true as const }));
    render(<DonationReviewPanel {...base} resolve={resolve} reveal={vi.fn()} />);
    const accept = screen.getByRole('button', { name: /accept the gift/i });
    expect(accept).toBeDisabled();
    expect(screen.getByText(/write a note first/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/note/i), 'Donor confirmed by phone');
    expect(accept).toBeEnabled();
    await userEvent.click(accept);
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('d1', true, 'Donor confirmed by phone'));
  });

  it('rejects with the same note rule', async () => {
    const resolve = vi.fn(async () => ({ ok: true as const }));
    render(<DonationReviewPanel {...base} resolve={resolve} reveal={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/note/i), 'Not a real gift');
    await userEvent.click(screen.getByRole('button', { name: /reject the gift/i }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('d1', false, 'Not a real gift'));
  });

  it('shows no resolve form when the gift is not in review or the viewer cannot resolve', () => {
    const { rerender } = render(<DonationReviewPanel {...base} inReview={false} resolve={vi.fn()} reveal={vi.fn()} />);
    expect(screen.queryByLabelText(/note/i)).not.toBeInTheDocument();
    rerender(<DonationReviewPanel {...base} canResolve={false} resolve={vi.fn()} reveal={vi.fn()} />);
    expect(screen.queryByLabelText(/note/i)).not.toBeInTheDocument();
  });

  it('reveals the address only after the button is pressed, and says it was recorded', async () => {
    const reveal = vi.fn(async () => ({ ok: true as const, email: 'full@example.com' }));
    render(<DonationReviewPanel {...base} inReview={false} resolve={vi.fn()} reveal={reveal} />);
    expect(screen.queryByText('full@example.com')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show full email/i }));
    expect(await screen.findByText('full@example.com')).toBeInTheDocument();
    expect(screen.getByText(/recorded in the audit log/i)).toBeInTheDocument();
  });
});
