import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  actor: null as unknown,
  allowed: true,
  budgetError: null as unknown,
}));
const rows = vi.hoisted(() => ({ value: [] as unknown[], range: null as unknown }));

vi.mock('@/lib/data/admin/session-next', () => ({
  getActor: async () => session.actor,
  allowed: () => session.allowed,
  spendAdminBudget: async () => {
    if (session.budgetError) throw session.budgetError;
  },
}));
vi.mock('@/lib/data/admin/services', () => ({
  analyticsService: {
    exportRows: async (_actor: unknown, range: unknown) => {
      rows.range = range;
      return rows.value;
    },
  },
}));

import { RateLimited } from '@ad/shared';
import { GET } from './route';

const call = (query = 'from=2026-11-01&to=2026-11-10') =>
  GET(new Request(`https://tv.test/admin/analytics/export?${query}`));

beforeEach(() => {
  session.actor = { accountId: 'a', role: 'admin', name: 'A' };
  session.allowed = true;
  session.budgetError = null;
  rows.value = [];
});

describe('analytics export route', () => {
  it('needs a signed in admin with analytics access', async () => {
    session.actor = null;
    expect((await call()).status).toBe(401);
    session.actor = { accountId: 'a', role: 'editor', name: 'A' };
    session.allowed = false;
    expect((await call()).status).toBe(403);
  });

  it('answers 429 with retry-after when the staff budget is spent', async () => {
    session.budgetError = new RateLimited(30);
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
  });

  it('returns headers only for an empty range and names the file by range', async () => {
    const response = await call();
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain(
      'analytics-2026-11-01-to-2026-11-10.csv',
    );
    expect(await response.text()).toBe(
      'day,video_id,title,archived,views,watch_seconds,completions\n',
    );
  });

  it('exports every title row, not only the top ten', async () => {
    rows.value = Array.from({ length: 25 }, (_, i) => ({
      day: '2026-11-02',
      videoId: `v${i}`,
      title: `Lesson ${i}`,
      archived: false,
      views: i + 1,
      watchMs: 60_000,
      completions: 0,
    }));
    const text = await (await call()).text();
    expect(text.trim().split('\n')).toHaveLength(26);
  });
});
