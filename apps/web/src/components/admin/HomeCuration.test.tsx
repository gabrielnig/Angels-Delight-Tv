// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHome } from '@/lib/data/admin/home-rules';
import { getStore } from '@/lib/data/admin/store';
import { HomeCuration } from './HomeCuration';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const s = structuredClone(getStore());
const ok = () => vi.fn().mockResolvedValue({ ok: true });
const view = (canCurate = true) => {
  const actions = { saveDraft: ok(), publish: ok(), restore: ok() };
  const state = {
    draft: defaultHome(),
    published: defaultHome(),
    previous: null,
    publishedAt: null,
  };
  render(
    <ToastProvider>
      <HomeCuration
        state={state}
        videos={s.videos}
        series={s.series}
        categories={s.categories}
        canCurate={canCurate}
        actions={actions}
      />
    </ToastProvider>,
  );
  return actions;
};

describe('HomeCuration', () => {
  it('starts clean with publish and save off', () => {
    view();
    expect(screen.getByText('Published and up to date')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it('marks changes, updates the preview and saves a draft', async () => {
    const a = view();
    fireEvent.click(screen.getByLabelText('Move My List up'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(a.saveDraft).toHaveBeenCalledTimes(1));
  });
  it('hides a row from the preview', () => {
    view();
    expect(screen.getAllByText('New this week').length).toBe(2);
    fireEvent.click(screen.getByRole('switch', { name: 'Show New this week' }));
    expect(screen.getAllByText('New this week').length).toBe(1);
  });
  it('locks controls without curate rights', () => {
    view(false);
    expect((screen.getByRole('button', { name: 'Add row' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
