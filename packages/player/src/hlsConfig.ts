import type { HlsEngineConfig } from '@videojs/hlsjs-video';
import { createKeyAwareLoader, shouldAttachAuth } from './token';

type HlsJsConfig = NonNullable<HlsEngineConfig['hlsJs']>;

export interface HlsConfigOptions {
  /** Origin of the app. Only requests to it carry the playback token. */
  appOrigin: string;
  getToken: () => string | null;
  /** The hls.js default loader class, injected so this module needs no hls.js import. */
  BaseLoader: new () => { load(context: { url: string }, ...rest: never[]): void };
}

/** Retries: 3 times with 1 s, 2 s, 4 s backoff (M08-S20 AC1). */
function retryPolicy() {
  return {
    default: {
      maxTimeToFirstByteMs: 10_000,
      maxLoadTimeMs: 30_000,
      timeoutRetry: {
        maxNumRetry: 3,
        retryDelayMs: 1_000,
        maxRetryDelayMs: 4_000,
        backoff: 'exponential' as const,
      },
      errorRetry: {
        maxNumRetry: 3,
        retryDelayMs: 1_000,
        maxRetryDelayMs: 4_000,
        backoff: 'exponential' as const,
      },
    },
  };
}

/**
 * hls.js settings for this audience (docs/ARCHITECTURE.md section 11): a conservative first bandwidth
 * guess, a 30 second buffer target, level capping to the player size, bearer auth on app origin requests
 * only and `ad-key://` key URIs resolved to the key route.
 */
export function createHlsConfig(opts: HlsConfigOptions): HlsJsConfig {
  return {
    autoStartLoad: false,
    abrEwmaDefaultEstimate: 500_000,
    capLevelToPlayerSize: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    manifestLoadPolicy: retryPolicy(),
    playlistLoadPolicy: retryPolicy(),
    fragLoadPolicy: retryPolicy(),
    keyLoadPolicy: retryPolicy(),
    loader: createKeyAwareLoader(
      opts.BaseLoader,
      opts.appOrigin,
    ) as unknown as HlsJsConfig['loader'],
    xhrSetup: (xhr, url) => {
      const token = opts.getToken();
      if (token && shouldAttachAuth(url, opts.appOrigin))
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    },
  } as HlsJsConfig;
}
