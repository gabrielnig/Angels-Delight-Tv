import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  jar: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
  profiles: [
    { id: 'kid', kids: true, hasPin: false },
    { id: 'adult', kids: false, hasPin: false },
  ],
  select: vi.fn(async () => ({ ok: true })),
  checkPassword: vi.fn(async () => ({ ok: true })),
}));

vi.mock('next/headers', () => ({ cookies: async () => mocks.jar }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../lib/data', () => ({
  getAccount: () => ({}),
  getAuth: () => ({ checkPassword: mocks.checkPassword }),
  getCatalog: () => ({}),
  getLibrary: () => ({}),
  getProfiles: () => ({ select: mocks.select, list: async () => mocks.profiles }),
}));
vi.mock('../lib/session', () => ({
  currentAccountId: async () => 'acc',
  getSession: async () => null,
  sessionCookieNames: { fixture: 'f', profile: 'p' },
}));
vi.mock('../server/data/mode', () => ({ realDataEnabled: () => false }));
vi.mock('../server/data/profile-io', () => ({ cookieProfileIo: () => ({}) }));
vi.mock('../server/guest/guest-view', () => ({ guestCookiesSecure: () => false }));

import { checkKidsPasswordAction, selectProfileAction } from './actions';

describe('Kids mode follows a kids profile on this device (M40-S09)', () => {
  beforeEach(() => mocks.jar.set.mockClear());

  it('selecting a kids profile sets the device hint to kids', async () => {
    await selectProfileAction('kid');
    expect(mocks.jar.set).toHaveBeenCalledWith('ad_gaud', 'k', expect.any(Object));
  });

  it('selecting an adult profile leaves the hint alone', async () => {
    await selectProfileAction('adult');
    expect(mocks.jar.set).not.toHaveBeenCalledWith('ad_gaud', expect.anything(), expect.anything());
  });

  it('leaving a kids profile with the password clears the hint', async () => {
    await checkKidsPasswordAction('pw');
    expect(mocks.jar.set).toHaveBeenCalledWith('ad_gaud', 'g', expect.any(Object));
  });
});
