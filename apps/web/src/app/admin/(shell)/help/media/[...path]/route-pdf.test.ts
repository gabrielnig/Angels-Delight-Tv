import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActor = vi.fn();
const opened: string[] = [];
let release = 'v1.0.0';
vi.mock('@/lib/data/admin/session-next', () => ({ getActor: () => getActor() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/help/sources', () => ({
  helpMediaRelease: () => release,
  openVideoSource: async (source: { kind: string; key?: string }) => {
    if (source.kind !== 'storage' || source.key !== 'help/v1.0.0/pdf/D02.pdf') return null;
    opened.push(source.key);
    const body = Buffer.from('%PDF-1.7 test');
    return { size: body.length, open: () => Readable.from([body]) };
  },
}));

const { GET } = await import('./route');
const call = (path: string[]) =>
  GET(new Request('http://x/admin/help/media/' + path.join('/')), {
    params: Promise.resolve({ path }),
  });

beforeEach(() => {
  getActor.mockReset();
  release = 'v1.0.0';
  opened.length = 0;
});

describe('GET /admin/help/media/pdf/<id>.pdf', () => {
  it('serves the prebuilt PDF of the release to staff as a private download', async () => {
    getActor.mockResolvedValue({ role: 'editor' });
    const res = await call(['pdf', 'D02.pdf']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="help-D02.pdf"');
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('%PDF-1.7 test');
  });

  it('refuses anyone who is not signed in staff', async () => {
    getActor.mockResolvedValue(null);
    expect((await call(['pdf', 'D02.pdf'])).status).toBe(401);
    expect(opened).toEqual([]);
  });

  it('answers 404 when the release has no PDF, for the sample release and for odd names', async () => {
    getActor.mockResolvedValue({ role: 'editor' });
    expect((await call(['pdf', 'D03.pdf'])).status).toBe(404);
    expect((await call(['pdf', '..', 'D02.pdf'])).status).toBe(404);
    expect((await call(['pdf', 'D02.pdf', 'x'])).status).toBe(404);
    release = 'sample';
    expect((await call(['pdf', 'D02.pdf'])).status).toBe(404);
  });
});
