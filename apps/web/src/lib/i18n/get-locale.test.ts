import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  cookie: undefined as string | undefined,
  session: null as null | { accountId: string; profile: { language?: string } | null },
  accountLocale: null as string | null,
  readCalls: [] as string[],
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(state.headers),
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock('../data/admin/theme-runtime', () => ({
  themeRuntime: async () => ({
    settings: {
      get: async (key: string) =>
        key === 'content.ui_languages'
          ? ['en', 'yo', 'ha']
          : key === 'content.default_language'
            ? 'en'
            : null,
    },
  }),
}));
vi.mock('../session', () => ({ getSession: async () => state.session }));
vi.mock('./account-locale', () => ({
  readAccountLocale: async (accountId: string) => {
    state.readCalls.push(accountId);
    return state.accountLocale;
  },
}));

import { getLocale } from './server';

describe('getLocale reads accounts.locale (M46-S02)', () => {
  beforeEach(() => {
    state.headers = {};
    state.cookie = undefined;
    state.session = null;
    state.accountLocale = null;
    state.readCalls = [];
  });

  it('uses the account locale when signed in and the profile has none', async () => {
    state.session = { accountId: 'a1', profile: { language: undefined } };
    state.accountLocale = 'ha';
    state.cookie = 'yo';
    expect(await getLocale()).toBe('ha');
    expect(state.readCalls).toEqual(['a1']);
  });

  it('keeps the profile language ahead of the account', async () => {
    state.session = { accountId: 'a1', profile: { language: 'yo' } };
    state.accountLocale = 'ha';
    expect(await getLocale()).toBe('yo');
  });

  it('does not read the account when signed out', async () => {
    state.cookie = 'yo';
    expect(await getLocale()).toBe('yo');
    expect(state.readCalls).toEqual([]);
  });

  it('a failed account lookup falls through to the cookie', async () => {
    state.session = { accountId: 'a1', profile: null };
    state.cookie = 'yo';
    state.accountLocale = null;
    expect(await getLocale()).toBe('yo');
  });
});
