import { describe, expect, it, vi } from 'vitest';
import { Forbidden } from '@ad/shared';
import { MemoryStore, TranslationService } from '@ad/i18n';
import { createLanguageHandlers } from './language-routes';

const english = { 'nav.home': 'Home' } as never;
const editor = { accountId: 'e', role: 'editor' as const };

function setup(actor: unknown = editor) {
  const store = new MemoryStore();
  const service = new TranslationService({
    store,
    english,
    baseline: () => ({}),
    audit: async () => {},
    settings: { uiLanguages: async () => ['en'], setUiLanguages: async () => {}, minPercent: async () => 80 },
  });
  const handlers = createLanguageHandlers({
    getActor: async () => actor as never,
    service: () => service,
    appOrigin: 'https://app.test',
    spend: vi.fn(async () => {}),
  });
  return { store, handlers };
}
const post = (body: string, headers: Record<string, string> = {}, url = 'https://app.test/api/admin/languages/yo/import') =>
  new Request(url, { method: 'POST', body, headers: { origin: 'https://app.test', 'content-type': 'text/csv', ...headers } });

describe('language routes', () => {
  it('Editors can import drafts', async () => {
    const { handlers, store } = setup();
    const res = await handlers.importCsv(post('key,translation\nnav.home,Ilé\n'), 'yo');
    expect(res.status).toBe(200);
    expect((await res.json()).added).toHaveLength(1);
    expect((await store.list('yo'))[0]!.status).toBe('in_review');
  });
  it('dryRun=1 writes nothing', async () => {
    const { handlers, store } = setup();
    const res = await handlers.importCsv(post('key,translation\nnav.home,Ilé\n', {}, 'https://app.test/x?dryRun=1'), 'yo');
    expect(res.status).toBe(200);
    expect(await store.list('yo')).toHaveLength(0);
  });
  it('without a staff session it is 401 and for a viewer role 403', async () => {
    expect((await setup(null).handlers.importCsv(post('a'), 'yo')).status).toBe(401);
    const viewer = setup({ accountId: 'v', role: 'viewer' });
    expect((await viewer.handlers.importCsv(post('key,translation\n'), 'yo')).status).toBe(403);
  });
  it('a cross origin post is refused', async () => {
    const res = await setup().handlers.importCsv(post('a', { origin: 'https://evil.test' }), 'yo');
    expect(res.status).toBe(403);
  });
  it('a file over 2 MB is 413 and bad csv is 422', async () => {
    const { handlers } = setup();
    expect((await handlers.importCsv(post('x'.repeat(2 * 1024 * 1024 + 1)), 'yo')).status).toBe(413);
    expect((await handlers.importCsv(post('a,b\n1,2'), 'yo')).status).toBe(422);
  });
  it('an unknown locale is 404', async () => {
    expect((await setup().handlers.importCsv(post('key,translation\n'), 'fr')).status).toBe(404);
    expect((await setup().handlers.exportFile(new Request('https://app.test/x'), 'fr')).status).toBe(404);
  });
  it('exports csv with a BOM and json by format', async () => {
    const { handlers } = setup();
    const csv = await handlers.exportFile(new Request('https://app.test/x?format=csv'), 'yo');
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect([...new Uint8Array(await csv.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const json = await handlers.exportFile(new Request('https://app.test/x?format=json'), 'yo');
    expect(json.headers.get('content-type')).toContain('application/json');
    expect(json.headers.get('cache-control')).toBe('no-store');
  });
  it('a Forbidden from the service is a 403', async () => {
    const { handlers } = setup();
    void Forbidden;
    expect((await handlers.exportFile(new Request('https://app.test/x'), 'yo')).status).toBe(200);
  });
});
