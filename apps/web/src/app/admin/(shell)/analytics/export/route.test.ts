import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  actor: null as unknown,
  allowed: true,
  budgetError: null as unknown,
}));
const rows = vi.hoisted(() => ({
  value: [] as unknown[],
  range: null as unknown,
  plan: null as number | null,
}));

vi.mock('@/lib/data/admin/session-next', () => ({
  getActor: async () => session.actor,
  allowed: () => session.allowed,
  spendAdminBudget: async () => {
    if (session.budgetError) throw session.budgetError;
  },
}));
vi.mock('@/lib/data/admin/services', () => ({
  analyticsService: {
    exportPlan: async () => ({ rows: rows.plan ?? rows.value.length }),
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
  rows.plan = null;
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

  it('sends a big range to the confirm page instead of building it in the request', async () => {
    rows.plan = 10_001;
    const response = await call();
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location')!, 'https://tv.test');
    expect(location.pathname).toBe('/admin/exports/new');
    expect(location.searchParams.get('kind')).toBe('analytics');
    expect(location.searchParams.get('from')).toBe('2026-11-01');
    expect(location.searchParams.get('to')).toBe('2026-11-10');
  });

  it('still answers in the request at exactly 10,000 rows', async () => {
    rows.plan = 10_000;
    expect((await call()).status).toBe(200);
  });
});
