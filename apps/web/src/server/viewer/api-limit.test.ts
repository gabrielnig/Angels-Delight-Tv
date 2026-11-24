import { describe, expect, it } from 'vitest';
import { createViewerApi, type ViewerRuntime } from './api';

const ORIGIN = 'https://app.test';
const ACCOUNT = '0192f0a0-0000-7000-8000-0000000000c1';

function setup(allowed: boolean) {
  const spent: string[] = [];
  const runtime = {
    ctx: {
      rateLimit: async (bucket: string, subject: string) => {
        spent.push(`${bucket}:${subject}`);
        return { allowed, retryAfterSeconds: 30 };
      },
    },
    appOrigin: ORIGIN,
    secureCookies: false,
    profileSecret: new Uint8Array(32).fill(1),
    resolveActor: async () => ({ accountId: ACCOUNT, role: 'viewer' as const }),
    lock: { read: async () => null },
  } as unknown as ViewerRuntime;
  return { api: createViewerApi(runtime), spent };
}

describe('viewer api global limit', () => {
  it('answers 429 with Retry-After before running any handler once the account budget is spent', async () => {
    const { api, spent } = setup(false);
    const res = await api.home(new Request(`${ORIGIN}/api/home?profileId=x`));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(spent).toEqual([`api:${ACCOUNT}`]);
  });

  it('does not spend the budget for an anonymous request', async () => {
    const { spent } = setup(true);
    const anon = createViewerApi({
      ctx: {},
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: new Uint8Array(32),
      resolveActor: async () => null,
    } as unknown as ViewerRuntime);
    // A personal route: home is a public GET for guests since M40 and has its own guest limits.
    const res = await anon.progress.get(new Request(`${ORIGIN}/api/progress?profileId=x`));
    expect(res.status).toBe(401);
    expect(spent).toEqual([]);
  });
});
