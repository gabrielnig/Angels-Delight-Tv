import { describe, expect, it } from 'vitest';
import { etagJson } from './http';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://app.test/api/browse', { headers });

describe('etagJson (M04-S05)', () => {
  it('sends the body with a strong ETag and says to revalidate every time, privately', async () => {
    const res = etagJson(req(), { items: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^"[A-Za-z0-9_-]{16,}"$/);
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(await res.json()).toEqual({ items: [1, 2, 3] });
  });

  it('answers 304 with no body when the client already has this version', async () => {
    const first = etagJson(req(), { a: 1 });
    const tag = first.headers.get('etag')!;
    const again = etagJson(req({ 'if-none-match': tag }), { a: 1 });
    expect(again.status).toBe(304);
    expect(again.headers.get('etag')).toBe(tag);
    expect(await again.text()).toBe('');
  });

  it('sends the full body when the data changed or the tag is for another version', async () => {
    const tag = etagJson(req(), { a: 1 }).headers.get('etag')!;
    const changed = etagJson(req({ 'if-none-match': tag }), { a: 2 });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('etag')).not.toBe(tag);
  });

  it('understands a list of tags and the weak form', () => {
    const tag = etagJson(req(), { a: 1 }).headers.get('etag')!;
    const list = etagJson(req({ 'if-none-match': `"zzz", W/${tag}` }), { a: 1 });
    expect(list.status).toBe(304);
  });

  it('gives different tags to different data, and the same tag to the same data', () => {
    const a = etagJson(req(), { x: 1 }).headers.get('etag');
    expect(etagJson(req(), { x: 1 }).headers.get('etag')).toBe(a);
    expect(etagJson(req(), { x: 2 }).headers.get('etag')).not.toBe(a);
  });
});
