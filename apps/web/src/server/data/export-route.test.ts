import { describe, expect, it, vi } from 'vitest';
import { createExportHandler } from './export-route';

const file = {
  exportedAt: '2026-06-15T12:00:00.000Z',
  account: { email: 'a@b.c', memberSince: 'x' },
  profiles: [],
  notificationPrefs: {
    bell: true,
    newEpisodes: true,
    newVideos: true,
    emailFrequency: 'off',
    emailConsentedAt: null,
  },
};

function setup(
  over: { account?: string | null; tokenAccount?: string | null; active?: boolean } = {},
) {
  const account = over.account === undefined ? 'a1' : over.account;
  const data = {
    verifyExportToken: vi.fn(() => (over.tokenAccount === undefined ? 'a1' : over.tokenAccount)),
    buildExport: vi.fn(async () => file),
  };
  const handler = createExportHandler({
    sessionAccountId: async () => account,
    accountInfo: async () => ({ email: 'a@b.c', memberSince: 'x' }),
    hasActiveExport: async () => over.active ?? true,
    data,
  });
  return { handler, data };
}
const req = (query = '?token=abc') => new Request(`https://app.test/api/account/export${query}`);

describe('account export download', () => {
  it('sends the file as a private attachment', async () => {
    const { handler } = setup();
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="angels-delight-data.json"',
    );
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(JSON.parse(await res.text())).toEqual(file);
  });

  it('sends a signed out visitor of the emailed link to sign in and back', async () => {
    const { handler, data } = setup({ account: null });
    const res = await handler(req());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/sign-in?next=' + encodeURIComponent('/api/account/export?token=abc'),
    );
    expect(data.buildExport).not.toHaveBeenCalled();
  });

  it('answers 404 when the export has expired or was never made', async () => {
    const { handler, data } = setup({ active: false });
    expect((await handler(req())).status).toBe(404);
    expect(data.buildExport).not.toHaveBeenCalled();
  });

  it('refuses a missing, invalid or expired token', async () => {
    expect((await setup().handler(req(''))).status).toBe(404);
    const { handler, data } = setup({ tokenAccount: null });
    expect((await handler(req())).status).toBe(404);
    expect(data.buildExport).not.toHaveBeenCalled();
  });

  it('refuses a token that belongs to another account', async () => {
    const { handler, data } = setup({ account: 'a1', tokenAccount: 'someone-else' });
    expect((await handler(req())).status).toBe(404);
    expect(data.buildExport).not.toHaveBeenCalled();
  });
});
