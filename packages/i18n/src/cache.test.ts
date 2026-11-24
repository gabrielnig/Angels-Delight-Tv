import { describe, expect, it } from 'vitest';
import { CatalogCache } from './cache';
import { MemoryStore } from './store';

describe('CatalogCache', () => {
  it('a published change is visible on the next request after the version bump', async () => {
    const store = new MemoryStore();
    const cache = new CatalogCache(store);
    await store.upsert('yo', { key: 'nav.home', text: 'Ilé', status: 'draft', sourceHash: null, updatedBy: 'e' });
    expect((await cache.approved('yo')).size).toBe(0);
    await store.setStatus('yo', 'nav.home', 'approved', 'a');
    expect((await cache.approved('yo')).size).toBe(0);
    cache.bump();
    expect((await cache.approved('yo')).get('nav.home')).toEqual({ status: 'approved', text: 'Ilé' });
  });
  it('a draft never reaches viewers', async () => {
    const store = new MemoryStore();
    const cache = new CatalogCache(store);
    await store.upsert('yo', { key: 'nav.home', text: 'Ilé', status: 'in_review', sourceHash: null, updatedBy: 'e' });
    cache.bump();
    expect((await cache.approved('yo')).has('nav.home')).toBe(false);
  });
  it('loads once per version', async () => {
    const store = new MemoryStore();
    let calls = 0;
    const orig = store.listApproved.bind(store);
    store.listApproved = async (l) => (calls++, orig(l));
    const cache = new CatalogCache(store);
    await cache.approved('yo');
    await cache.approved('yo');
    expect(calls).toBe(1);
  });
});
