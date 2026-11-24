import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  note: null as null | { kind: 'link' | 'signup'; hint: string },
}));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
);
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('../../../../server/auth/google-runtime', () => ({
  googleNoteInfo: async () => state.note,
}));
vi.mock('../../../../lib/data', () => ({ getSite: () => ({ content: async () => ({}) }) }));
vi.mock('../../../../components/AuthLayouts', () => ({ AuthCardPage: () => null }));
vi.mock('../../../../components/auth/AuthScreens', () => ({ LinkGoogleScreen: () => null }));

import Page from './page';

beforeEach(() => {
  state.note = null;
  redirect.mockClear();
});

describe('link-google page', () => {
  it('sends a visit with no waiting link to sign in', async () => {
    await expect(Page()).rejects.toThrow('redirect:/sign-in');
  });

  it('does not accept the sign up note', async () => {
    state.note = { kind: 'signup', hint: 'c***@x.co' };
    await expect(Page()).rejects.toThrow('redirect:/sign-in');
  });

  it('renders for a waiting link note', async () => {
    state.note = { kind: 'link', hint: 'c***@x.co' };
    await expect(Page()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
