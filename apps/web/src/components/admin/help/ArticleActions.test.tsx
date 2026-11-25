// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../Toast';
import { ArticleActions } from './ArticleActions';
import { SAVE_FAILED_MESSAGE } from './retry-save';

afterEach(cleanup);
const ok = async () => ({ ok: true as const });

describe('ArticleActions', () => {
  it('marks a guide done by button and shows the new state', async () => {
    const setDone = vi.fn(ok);
    render(
      <ArticleActions
        guide="D02"
        initial={{ done: false, helpful: null }}
        setDone={setDone}
        setHelpful={ok}
      />,
    );
    const button = screen.getByRole('button', { name: 'Mark as done' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(setDone).toHaveBeenCalledWith('D02', true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done. Mark as not done' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('saves one helpful answer and lets it change', async () => {
    const setHelpful = vi.fn(ok);
    render(
      <ArticleActions
        guide="D02"
        initial={{ done: false, helpful: null }}
        setDone={ok}
        setHelpful={setHelpful}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(setHelpful).toHaveBeenLastCalledWith('D02', true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(setHelpful).toHaveBeenLastCalledWith('D02', false);
    expect(await screen.findByText('Thanks. Your answer is saved.')).toBeInTheDocument();
  });

  it('keeps the tick on screen and retries by itself when a save fails', async () => {
    const setDone = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
    render(
      <ToastProvider>
        <ArticleActions
          guide="D02"
          initial={{ done: false, helpful: null }}
          setDone={setDone}
          setHelpful={ok}
        />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    expect(await screen.findByText(SAVE_FAILED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done. Mark as not done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(setDone).toHaveBeenCalledTimes(2);
    expect(setDone).toHaveBeenLastCalledWith('D02', true);
  });
});
