import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safePlaceholderBlur, safePlaceholderColor } from './placeholder-safe';

describe('placeholder-safe', () => {
  it('is not a client module, so server components can call it', () => {
    const source = readFileSync(join(__dirname, 'placeholder-safe.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('accepts a hex colour and drops anything else', () => {
    expect(safePlaceholderColor('#1a2b3c')).toBe('#1a2b3c');
    expect(safePlaceholderColor('red')).toBeUndefined();
    expect(safePlaceholderColor(null)).toBeUndefined();
  });

  it('accepts a small webp data url and drops anything else', () => {
    expect(safePlaceholderBlur('data:image/webp;base64,AAAA')).toBe('data:image/webp;base64,AAAA');
    expect(safePlaceholderBlur('data:image/png;base64,AAAA')).toBeUndefined();
    expect(safePlaceholderBlur(`data:image/webp;base64,${'A'.repeat(3000)}`)).toBeUndefined();
  });
});
