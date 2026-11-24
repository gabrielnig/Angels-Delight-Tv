// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const loadDraftsAction = vi.fn(async () => ({ ok: true as const, added: 31, skipped: 2 }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/(shell)/languages/actions', () => ({
  approveTranslationsAction: vi.fn(),
  saveTranslationAction: vi.fn(),
  loadDraftsAction: (...args: unknown[]) =>
    (loadDraftsAction as (...a: unknown[]) => unknown)(...args),
}));
vi.mock('./Workspace', () => ({ Workspace: () => <div data-testid="workspace" /> }));
vi.mock('./ImportDialog', () => ({ ImportDialog: () => null }));

import { WorkspaceScreen } from './WorkspaceScreen';

afterEach(cleanup);
const base = {
  locale: { code: 'yo', endonym: 'Yorùbá', englishName: 'Yoruba' },
  rows: [],
  canApprove: true,
};

describe('sample drafts in the workspace', () => {
  it('offers the button only when the language has a sample draft', () => {
    render(<WorkspaceScreen {...base} />);
    expect(screen.queryByRole('button', { name: /sample draft/i })).toBeNull();
    cleanup();
    render(<WorkspaceScreen {...base} hasDraft />);
    expect(screen.getByRole('button', { name: /load sample draft/i })).toBeTruthy();
  });

  it('loads the draft and says it is unreviewed', async () => {
    render(<WorkspaceScreen {...base} hasDraft />);
    await userEvent.click(screen.getByRole('button', { name: /load sample draft/i }));
    expect(loadDraftsAction).toHaveBeenCalledWith('yo');
    const note = await screen.findByRole('status');
    expect(note.textContent).toMatch(/31 sample drafts/i);
    expect(note.textContent).toMatch(/not reviewed/i);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('shows the failure and does not claim success', async () => {
    loadDraftsAction.mockResolvedValueOnce({
      ok: false as never,
      error: 'You do not have permission to do this.',
    } as never);
    render(<WorkspaceScreen {...base} hasDraft />);
    await userEvent.click(screen.getByRole('button', { name: /load sample draft/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/);
  });
});
