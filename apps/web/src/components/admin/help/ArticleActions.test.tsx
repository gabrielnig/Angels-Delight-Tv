// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArticleActions } from './ArticleActions';

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

  it('keeps the old state and says so when a save fails', async () => {
    render(
      <ArticleActions
        guide="D02"
        initial={{ done: false, helpful: null }}
        setDone={async () => ({ ok: false as const })}
        setHelpful={ok}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save that. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Mark as done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
