import { describe, expect, it } from 'vitest';
import { createViewerApi, type ViewerRuntime } from './api';

const ORIGIN = 'https://app.test';
const ACCOUNT = '0192f0a0-0000-7000-8000-0000000000c1';

function api() {
  return createViewerApi({
    ctx: {},
    appOrigin: ORIGIN,
    secureCookies: false,
    profileSecret: new Uint8Array(32).fill(1),
    resolveActor: async () => ({ accountId: ACCOUNT, role: 'viewer' as const }),
  } as unknown as ViewerRuntime);
}

const post = (headers: Record<string, string>) =>
  new Request(`${ORIGIN}/api/progress`, { method: 'POST', headers, body: '{}' });

describe('viewer api strict origin on mutating methods (L-14)', () => {
  it('refuses a POST with no Origin and no Sec-Fetch-Site', async () => {
    expect((await api().progress.save(post({}))).status).toBe(403);
  });
  it('refuses same-site and none Sec-Fetch-Site without Origin', async () => {
    expect((await api().progress.save(post({ 'sec-fetch-site': 'same-site' }))).status).toBe(403);
    expect((await api().progress.save(post({ 'sec-fetch-site': 'none' }))).status).toBe(403);
  });
  it('refuses a foreign or opaque Origin', async () => {
    expect((await api().progress.save(post({ origin: 'https://evil.test' }))).status).toBe(403);
    expect((await api().progress.save(post({ origin: 'null' }))).status).toBe(403);
  });
  it('lets a same-origin request past the check (it then fails inside the stub context, not with 403)', async () => {
    for (const headers of [{ origin: ORIGIN }, { 'sec-fetch-site': 'same-origin' }] as Record<
      string,
      string
    >[]) {
      const outcome = await api()
        .progress.save(post(headers))
        .then((r) => r.status)
        .catch(() => 'reached handler');
      expect(outcome).not.toBe(403);
    }
  });
});
