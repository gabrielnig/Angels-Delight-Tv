import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register';

function fake(waiting: { postMessage: () => void } | null = null) {
  const containerListeners = new Map<string, () => void>();
  const regListeners = new Map<string, () => void>();
  const registration = {
    waiting,
    installing: null as null | {
      state: string;
      addEventListener: (t: string, f: () => void) => void;
    },
    addEventListener: (t: string, f: () => void) => void regListeners.set(t, f),
  };
  const container = {
    controller: {},
    register: vi.fn(async () => registration),
    addEventListener: (t: string, f: () => void) => void containerListeners.set(t, f),
  };
  return { container, registration, containerListeners, regListeners };
}

describe('registerServiceWorker', () => {
  it('does nothing without service worker support', async () => {
    expect(
      await registerServiceWorker({
        serviceWorker: undefined,
        isPlaying: () => false,
        onUpdated: vi.fn(),
      }),
    ).toBeNull();
  });

  it('registers /sw.js at the root scope', async () => {
    const f = fake();
    await registerServiceWorker({
      serviceWorker: f.container,
      isPlaying: () => false,
      onUpdated: vi.fn(),
    });
    expect(f.container.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });

  it('activates a waiting update when nothing is playing and then announces it', async () => {
    const post = vi.fn();
    const f = fake({ postMessage: post });
    const onUpdated = vi.fn();
    await registerServiceWorker({ serviceWorker: f.container, isPlaying: () => false, onUpdated });
    expect(post).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    f.containerListeners.get('controllerchange')!();
    expect(onUpdated).toHaveBeenCalledTimes(1);
  });

  it('holds the update while a video plays and applies it later', async () => {
    const post = vi.fn();
    const f = fake({ postMessage: post });
    let playing = true;
    const handle = await registerServiceWorker({
      serviceWorker: f.container,
      isPlaying: () => playing,
      onUpdated: vi.fn(),
    });
    expect(post).not.toHaveBeenCalled();
    playing = false;
    handle!.applyUpdateIfSafe();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not announce the first install, only replacements', async () => {
    const f = fake();
    f.container.controller = null as never;
    const onUpdated = vi.fn();
    await registerServiceWorker({ serviceWorker: f.container, isPlaying: () => false, onUpdated });
    f.containerListeners.get('controllerchange')?.();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('swallows registration errors', async () => {
    const f = fake();
    f.container.register = vi.fn(async () => {
      throw new Error('blocked');
    });
    expect(
      await registerServiceWorker({
        serviceWorker: f.container,
        isPlaying: () => false,
        onUpdated: vi.fn(),
      }),
    ).toBeNull();
  });
});
