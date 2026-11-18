import { describe, expect, it, vi } from 'vitest';
import { clearServiceWorkerCaches } from './purge';

describe('clearServiceWorkerCaches', () => {
  it('tells the active worker to clear every cache', () => {
    const postMessage = vi.fn();
    expect(clearServiceWorkerCaches({ serviceWorker: { controller: { postMessage } } })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ type: 'CLEAR_CACHES' });
  });

  it('reports false when there is no worker, so the caller can reload', () => {
    expect(clearServiceWorkerCaches({ serviceWorker: { controller: null } })).toBe(false);
    expect(clearServiceWorkerCaches({})).toBe(false);
  });

  it('reports false when messaging throws', () => {
    const postMessage = vi.fn(() => {
      throw new Error('gone');
    });
    expect(clearServiceWorkerCaches({ serviceWorker: { controller: { postMessage } } })).toBe(false);
  });
});
