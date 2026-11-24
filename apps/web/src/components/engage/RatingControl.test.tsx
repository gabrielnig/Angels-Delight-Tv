// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { RatingControl } from './RatingControl';

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const group = () => screen.getByRole('group', { name: 'Rate this title' });
const button = (name: string) => within(group()).getByRole('button', { name });

describe('RatingControl', () => {
  it('is a labelled group of three toggle buttons, none pressed for an unrated title', () => {
    wrap(<RatingControl initial={null} save={vi.fn()} />);
    for (const name of ['Not for me', 'I like this', 'Love this']) {
      expect(button(name)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('presses at once, saves the value and unpresses the others', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    wrap(<RatingControl initial={1} save={save} />);
    expect(button('I like this')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button('Love this'));
    expect(button('Love this')).toHaveAttribute('aria-pressed', 'true');
    expect(button('I like this')).toHaveAttribute('aria-pressed', 'false');
    expect(save).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Rating saved')).toBeInTheDocument();
  });

  it('selecting the active level clears it and offers Undo', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    wrap(<RatingControl initial={2} save={save} />);
    await userEvent.click(button('Love this'));
    expect(save).toHaveBeenCalledWith(null);
    expect(button('Love this')).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(save).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(button('Love this')).toHaveAttribute('aria-pressed', 'true'));
  });

  it('rolls back and shows an error toast when the save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('no'));
    wrap(<RatingControl initial={null} save={save} />);
    await userEvent.click(button('I like this'));
    await waitFor(() => expect(button('I like this')).toHaveAttribute('aria-pressed', 'false'));
    expect(await screen.findByText('We could not save your rating. Try again.')).toBeInTheDocument();
  });

  it('a guest click calls onGuestAsk and never saves', async () => {
    const save = vi.fn();
    const ask = vi.fn();
    wrap(<RatingControl initial={null} save={save} guest onGuestAsk={ask} />);
    await userEvent.click(button('I like this'));
    expect(ask).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(button('I like this')).toHaveAttribute('aria-pressed', 'false');
  });

  it('is disabled with a message when the title is unavailable', () => {
    wrap(<RatingControl initial={null} save={vi.fn()} unavailable />);
    expect(button('I like this')).toBeDisabled();
    expect(screen.getByText('This title is no longer available')).toBeInTheDocument();
  });
});
