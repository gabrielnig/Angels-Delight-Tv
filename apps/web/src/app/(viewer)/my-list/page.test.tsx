// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewer: { kind: 'guest', ctx: { guest: true, audience: 'adult' } } as unknown,
  myList: vi.fn(),
}));
vi.mock('../../../lib/session', () => ({ getViewerOrGuest: async () => mocks.viewer }));
vi.mock('../../../lib/data', () => ({
  getSite: () => ({ content: async () => ({ signUpOpen: true }) }),
  getLibrary: () => ({ myList: mocks.myList }),
}));
vi.mock('../../../components/Shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../components/mylist/MyListScreen', () => ({
  MyListScreen: () => <p>my list screen</p>,
}));

import MyListPage from './page';

describe('my list page', () => {
  beforeEach(() => {
    mocks.myList.mockReset();
    mocks.myList.mockResolvedValue({ items: [], total: 0, nextCursor: null, hiddenCount: 0 });
  });

  it('explains My List to a guest and never reads a list', async () => {
    render(await MyListPage());
    expect(
      screen.getByRole('heading', { name: 'Keep a list that follows you' }),
    ).toBeInTheDocument();
    expect(mocks.myList).not.toHaveBeenCalled();
  });

  it('shows the list to a signed in profile', async () => {
    mocks.viewer = { kind: 'account', ctx: { accountId: 'a', profileId: 'p', audience: 'adult' } };
    render(await MyListPage());
    expect(screen.getByText('my list screen')).toBeInTheDocument();
  });
});
