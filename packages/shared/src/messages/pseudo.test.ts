import { describe, expect, it } from 'vitest';
import { pseudo } from './pseudo';

describe('pseudo', () => {
  it('keeps placeholders', () => {
    const out = pseudo('Resumed from {time} on {device}');
    expect(out).toContain('{time}');
    expect(out).toContain('{device}');
  });
  it('is about 40 percent longer', () => {
    const src = 'Continue learning where you stopped';
    const ratio = pseudo(src).length / src.length;
    expect(ratio).toBeGreaterThanOrEqual(1.3);
    expect(ratio).toBeLessThanOrEqual(1.7);
  });
  it('contains the dot below vowels and a tone mark', () => {
    const out = pseudo('Play every video now please').normalize('NFC');
    for (const ch of ['ẹ', 'ọ', 'ṣ', 'ị', 'ụ']) expect(out).toContain(ch);
    expect(out.normalize('NFD')).toMatch(/[̀́]/);
  });
  it('keeps the plural shape', () => {
    const out = pseudo({ one: '{count} video', other: '{count} videos' });
    expect(Object.keys(out)).toEqual(['one', 'other']);
  });
});
