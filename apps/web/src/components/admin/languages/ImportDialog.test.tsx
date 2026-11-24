// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from './ImportDialog';

afterEach(cleanup);
const plan = {
  dryRun: true,
  added: [{ row: 2, key: 'nav.home' }],
  changed: [{ row: 3, key: 'nav.browse' }],
  unchanged: [],
  rejected: [{ row: 4, key: 'nav.x', reason: 'Unknown key' }],
  blank: 0,
};
const file = (text = 'key,translation\nnav.home,Ilé') => new File([text], 'yo.csv', { type: 'text/csv' });
const setup = (post = vi.fn(async () => ({ ok: true as const, plan }))) => {
  const onDone = vi.fn();
  render(<ImportDialog open locale={{ code: 'yo', englishName: 'Yoruba' }} onClose={() => {}} onDone={onDone} post={post} />);
  return { post, onDone };
};

describe('ImportDialog', () => {
  it('shows the dry run table before confirming', async () => {
    const { post } = setup();
    await userEvent.upload(screen.getByLabelText(/csv file/i), file());
    await userEvent.click(screen.getByRole('button', { name: /check file/i }));
    expect(post).toHaveBeenCalledWith(expect.any(String), true);
    expect(await screen.findByText(/1 added/i)).toBeTruthy();
    expect(screen.getByText(/1 changed/i)).toBeTruthy();
    expect(screen.getByText(/Unknown key/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /import 2 rows/i })).toBeTruthy();
  });
  it('confirming imports for real and says imported rows go to review', async () => {
    const { post, onDone } = setup();
    await userEvent.upload(screen.getByLabelText(/csv file/i), file());
    await userEvent.click(screen.getByRole('button', { name: /check file/i }));
    await userEvent.click(await screen.findByRole('button', { name: /import 2 rows/i }));
    expect(post).toHaveBeenLastCalledWith(expect.any(String), false);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.getByText(/go to review/i)).toBeTruthy();
  });
  it('file too large shows the limit', async () => {
    const { post } = setup();
    await userEvent.upload(screen.getByLabelText(/csv file/i), file('x'.repeat(2 * 1024 * 1024 + 1)));
    expect(screen.getByRole('alert').textContent).toMatch(/2 MB/);
    expect(post).not.toHaveBeenCalled();
  });
  it('network failure keeps the chosen file', async () => {
    const post = vi.fn(async () => {
      throw new Error('offline');
    });
    setup(post as never);
    await userEvent.upload(screen.getByLabelText(/csv file/i), file());
    await userEvent.click(screen.getByRole('button', { name: /check file/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('yo.csv')).toBeTruthy();
    expect(screen.getByRole('button', { name: /check file/i })).toBeTruthy();
  });
});
