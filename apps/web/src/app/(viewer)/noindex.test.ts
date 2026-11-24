import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/session', () => ({ getViewerOrGuest: vi.fn(), requireProfile: vi.fn() }));
vi.mock('../../lib/data', () => ({ getCatalog: vi.fn(), getLibrary: vi.fn(), getSite: vi.fn() }));
vi.mock('../../components/Shell', () => ({ AppShell: () => null }));

describe('pages with nothing for an index (M40-S18)', () => {
  it('search and my list ask not to be indexed', async () => {
    const search = await import('./search/page');
    const myList = await import('./my-list/page');
    expect(search.metadata.robots).toEqual({ index: false, follow: true });
    expect(myList.metadata.robots).toEqual({ index: false, follow: true });
  });
});
