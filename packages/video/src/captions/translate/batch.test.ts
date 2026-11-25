import { describe, expect, it, vi } from 'vitest';
import { translateTexts } from './batch';
import type { Translator } from './types';

const upper = (over: Partial<Translator> = {}): Translator => ({
  name: 'test',
  supports: () => true,
  translate: vi.fn<Translator['translate']>(async ({ texts }) => ({ texts: texts.map((t) => t.toUpperCase()), model: 'm', chars: texts.join('').length })),
  ...over,
});
const cues = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`);

describe('translateTexts', () => {
  it('splits cues into batches of about 20', async () => {
    const t = upper();
    await translateTexts(t, cues(45), { source: 'en', target: 'yo' });
    expect((t.translate as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].texts.length)).toEqual([20, 20, 5]);
  });
  it('restores order and keeps the count', async () => {
    const out = await translateTexts(upper(), cues(45), { source: 'en', target: 'yo' });
    expect(out.texts).toEqual(cues(45).map((c) => c.toUpperCase()));
  });
  it('falls back to cue by cue when the line count differs', async () => {
    let first = true;
    const t = upper({
      translate: vi.fn<Translator['translate']>(async ({ texts }) => {
        if (first && texts.length > 1) {
          first = false;
          return { texts: [texts.join(' ')], model: 'm', chars: 1 };
        }
        return { texts: texts.map((x) => x.toUpperCase()), model: 'm', chars: 1 };
      }),
    });
    const out = await translateTexts(t, cues(3), { source: 'en', target: 'yo' });
    expect(out.texts).toEqual(['LINE 0', 'LINE 1', 'LINE 2']);
    expect((t.translate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(4);
  });
  it('never merges text across cue boundaries', async () => {
    const out = await translateTexts(upper(), ['a', '', 'b'], { source: 'en', target: 'yo' });
    expect(out.texts).toEqual(['A', '', 'B']);
  });
  it('reports the model and the characters sent', async () => {
    const out = await translateTexts(upper(), ['abc', 'de'], { source: 'en', target: 'yo' });
    expect(out.model).toBe('m');
    expect(out.chars).toBe(5);
  });
  it('refuses a job over the character limit before any call', async () => {
    const t = upper();
    await expect(translateTexts(t, ['x'.repeat(50)], { source: 'en', target: 'yo', maxChars: 10 })).rejects.toThrow(/limit/i);
    expect(t.translate).not.toHaveBeenCalled();
  });
  it('refuses an unsupported pair with a plain permanent error', async () => {
    const t = upper({ supports: () => false });
    await expect(translateTexts(t, ['a'], { source: 'en', target: 'pcm' })).rejects.toMatchObject({ permanent: true });
  });
});
