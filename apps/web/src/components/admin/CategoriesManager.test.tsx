// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoriesManager } from './CategoriesManager';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
afterEach(cleanup);

const cats = [
  { id: 'a', name: 'Science', hidden: false, position: 0, videoCount: 2 },
  { id: 'b', name: 'Health', hidden: true, position: 1, videoCount: 0 },
];
const ok = () => vi.fn().mockResolvedValue({ ok: true });
const actions = () => ({ create: ok(), rename: ok(), hide: ok(), move: ok(), remove: ok() });
const view = (a = actions(), canManage = true) =>
  render(
    <ToastProvider>
      <CategoriesManager categories={cats} canManage={canManage} actions={a} />
    </ToastProvider>,
  );

describe('CategoriesManager', () => {
  it('shows counts and the hidden state in words', () => {
    view();
    expect(screen.getByText('2 videos')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
  });
  it('disables first up and last down', () => {
    view();
    expect((screen.getByLabelText('Move Science up') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Health down') as HTMLButtonElement).disabled).toBe(true);
  });
  it('moves a category', async () => {
    const a = actions();
    view(a);
    fireEvent.click(screen.getByLabelText('Move Science down'));
    await waitFor(() => expect(a.move).toHaveBeenCalledWith('a', 1));
  });
  it('disables every control without manage rights', () => {
    view(actions(), false);
    expect(
      (screen.getByRole('button', { name: 'Add category' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText('Hide Science') as HTMLButtonElement).disabled).toBe(true);
  });
});
