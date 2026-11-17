import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The preview redeclares the type scale tokens (see preview.css). This keeps them from drifting from tokens.css. */
describe('preview.css type scale', () => {
  const tokens = readFileSync(
    resolve(import.meta.dirname, '../../../../../../packages/ui/src/tokens.css'),
    'utf8',
  );
  const preview = readFileSync(resolve(import.meta.dirname, 'preview.css'), 'utf8');
  const declarations = (css: string) =>
    Object.fromEntries(
      [...css.matchAll(/(--text-[a-z0-9]+):\s*(calc\([^;]*\));/g)].map((m) => [m[1], m[2]]),
    );

  it('declares every text token of tokens.css with the same formula', () => {
    const fromTokens = declarations(tokens);
    const fromPreview = declarations(preview);
    expect(Object.keys(fromTokens).length).toBeGreaterThanOrEqual(10);
    expect(fromPreview).toEqual(fromTokens);
  });

  it('has no hardcoded colours or font names', () => {
    expect(preview).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|font-family:\s*["'A-Z]/);
  });
});
