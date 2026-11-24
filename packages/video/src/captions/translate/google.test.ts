import { describe, expect, it, vi } from 'vitest';
import { GoogleTranslator } from './google';

const ok = (texts: string[]) =>
  new Response(JSON.stringify({ data: { translations: texts.map((t) => ({ translatedText: t })) } }), { status: 200 });

describe('GoogleTranslator', () => {
  it('maps our codes to the provider codes and sends the key as a header', async () => {
    const fetchFn = vi.fn(async () => ok(['Ẹ kú àbọ̀']));
    const t = new GoogleTranslator({ apiKey: 'SECRET', fetch: fetchFn as never });
    const out = await t.translate({ source: 'en', target: 'yo', texts: ['Welcome'] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('SECRET');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET');
    expect(JSON.parse(init.body as string)).toMatchObject({ source: 'en', target: 'yo', q: ['Welcome'], format: 'text' });
    expect(out.texts).toEqual(['Ẹ kú àbọ̀'.normalize('NFC')]);
  });
  it('decodes HTML entities the API puts in text', async () => {
    const t = new GoogleTranslator({ apiKey: 'k', fetch: (async () => ok(['It&#39;s &amp; done'])) as never });
    expect((await t.translate({ source: 'en', target: 'ha', texts: ['x'] })).texts).toEqual(["It's & done"]);
  });
  it('supports yo, ig and ha but not pcm', () => {
    const t = new GoogleTranslator({ apiKey: 'k' });
    expect(t.supports('en', 'yo') && t.supports('en', 'ig') && t.supports('en', 'ha')).toBe(true);
    expect(t.supports('en', 'pcm')).toBe(false);
  });
  it('a provider error becomes a retryable error, and a 400 a permanent one', async () => {
    const t503 = new GoogleTranslator({ apiKey: 'k', fetch: (async () => new Response('x', { status: 503 })) as never });
    await expect(t503.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toMatchObject({ permanent: false });
    const t400 = new GoogleTranslator({ apiKey: 'k', fetch: (async () => new Response('x', { status: 400 })) as never });
    await expect(t400.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toMatchObject({ permanent: true });
  });
  it('the key never appears in an error message', async () => {
    const t = new GoogleTranslator({ apiKey: 'SECRET', fetch: (async () => { throw new Error('connect SECRET failed'); }) as never });
    await expect(t.translate({ source: 'en', target: 'yo', texts: ['a'] })).rejects.toSatisfy((e: Error) => !e.message.includes('SECRET'));
  });
});
