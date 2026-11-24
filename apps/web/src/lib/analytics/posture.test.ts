import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const REPO = resolve(__dirname, '../../../../..');
const WEB_SRC = resolve(__dirname, '../..');

const inner = vi.hoisted(() => ({ track: vi.fn(), flush: vi.fn(), idle: vi.fn(), dispose: vi.fn() }));
vi.mock('@ad/analytics/client', () => ({
  classifyDevice: () => 'desktop',
  createAnalyticsClient: () => inner,
}));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|int\.test|e2e|stack)\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('analytics posture (M45-S12, D-L6-3)', () => {
  beforeEach(() => {
    inner.track.mockReset();
    vi.resetModules();
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', globalPrivacyControl: false, doNotTrack: null },
      configurable: true,
    });
  });

  it('skips search events when Global Privacy Control is on and keeps playback health events', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', globalPrivacyControl: true },
      configurable: true,
    });
    const { getAnalyticsClient } = await import('./browser');
    const client = getAnalyticsClient();
    client.track({ kind: 'search', resultCount: 0, query: 'farm' });
    client.track({ kind: 'error', code: 'player.network' });
    expect(inner.track).toHaveBeenCalledTimes(1);
    expect(inner.track).toHaveBeenCalledWith({ kind: 'error', code: 'player.network' });
  });

  it('skips search events under Do Not Track too', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', doNotTrack: '1' },
      configurable: true,
    });
    const { getAnalyticsClient } = await import('./browser');
    getAnalyticsClient().track({ kind: 'search', resultCount: 3 });
    expect(inner.track).not.toHaveBeenCalled();
  });

  it('records search events when no signal is set', async () => {
    const { getAnalyticsClient } = await import('./browser');
    getAnalyticsClient().track({ kind: 'search', resultCount: 3 });
    expect(inner.track).toHaveBeenCalledTimes(1);
  });

  it('loads scripts only from origins that are named in SECURITY.md, and none for analytics', () => {
    const allowed: { host: string; evidence: string }[] = [
      { host: 'challenges.cloudflare.com', evidence: 'Cloudflare Turnstile' },
    ];
    const security = readFileSync(join(REPO, 'docs/SECURITY.md'), 'utf8');
    const decisions = readFileSync(join(REPO, 'docs/DECISIONS.md'), 'utf8');
    const files = [
      ...sources(WEB_SRC),
      ...sources(join(REPO, 'packages/player/src')),
      ...sources(join(REPO, 'packages/ui/src')),
    ];
    const found = new Set<string>();
    const patterns = [
      /\.src\s*=\s*['"`](?:https?:)?\/\/([^/'"`?:]+)/g,
      /<script[^>]*\ssrc=\s*["'{`]+(?:https?:)?\/\/([^/'"`?:]+)/g,
      /<Script[^>]*\ssrc=\s*["'{`]+(?:https?:)?\/\/([^/'"`?:]+)/g,
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of patterns) for (const m of text.matchAll(pattern)) found.add(m[1]!);
    }
    for (const host of found) {
      const entry = allowed.find((a) => a.host === host);
      expect(entry, `third party script origin ${host} needs a logged decision and an entry here`).toBeDefined();
      expect(security + decisions, `${host} must be described in SECURITY.md or DECISIONS.md`).toContain(entry!.evidence);
    }
    for (const host of found) expect(host).not.toMatch(/google-analytics|googletagmanager|facebook|segment|mixpanel|hotjar|plausible|posthog/);
  });

  it('adds no third party script origin to the root layout', () => {
    const layout = readFileSync(join(WEB_SRC, 'app/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/https?:\/\//);
    expect(layout).not.toMatch(/next\/script/);
  });

  it('never keeps an analytics id in device storage or a cookie', () => {
    for (const dir of ['packages/analytics/src/client', 'apps/web/src/lib/analytics']) {
      for (const file of sources(join(REPO, dir))) {
        const text = readFileSync(file, 'utf8');
        expect(text, file).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
      }
    }
  });
});
