import { describe, expect, it, vi } from 'vitest';
import { createHlsConfig } from './hlsConfig';

const APP = 'https://app.example.test';

class Base {
  load() {}
}

function make(token: string | null = 'T') {
  return createHlsConfig({ appOrigin: APP, getToken: () => token, BaseLoader: Base });
}

describe('createHlsConfig', () => {
  it('uses audience tuned defaults', () => {
    const c = make();
    expect(c.abrEwmaDefaultEstimate).toBe(500_000);
    expect(c.capLevelToPlayerSize).toBe(true);
    expect(c.maxBufferLength).toBe(30);
    expect(c.autoStartLoad).toBe(false);
  });

  it('retries three times with exponential backoff from one second', () => {
    const policy = make().fragLoadPolicy?.default;
    expect(policy?.errorRetry).toMatchObject({ maxNumRetry: 3, retryDelayMs: 1000, backoff: 'exponential' });
  });

  it('adds the bearer token for app origin requests only', () => {
    const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;
    make().xhrSetup?.(xhr, `${APP}/api/play/v1/720.m3u8`, {} as never);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer T');
    const other = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;
    make().xhrSetup?.(other, 'https://media.example.test/v/a/720/seg_1.ts?exp=1&sig=x', {} as never);
    expect(other.setRequestHeader).not.toHaveBeenCalled();
  });

  it('sends no header without a token', () => {
    const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;
    make(null).xhrSetup?.(xhr, `${APP}/api/hls/keys/v1`, {} as never);
    expect(xhr.setRequestHeader).not.toHaveBeenCalled();
  });

  it('resolves ad-key URIs through the loader', () => {
    const seen: string[] = [];
    class Spy {
      load(c: { url: string }) {
        seen.push(c.url);
      }
    }
    const c = createHlsConfig({ appOrigin: APP, getToken: () => 'T', BaseLoader: Spy });
    const Loader = c.loader as unknown as new () => Spy;
    new Loader().load({ url: 'ad-key://v1' });
    expect(seen).toEqual([`${APP}/api/hls/keys/v1`]);
  });
});
