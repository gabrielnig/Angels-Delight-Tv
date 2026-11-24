import { describe, expect, it } from 'vitest';
import { applyGlossary, parseGlossary } from './glossary';

describe('glossary', () => {
  it('parses one term per line and ignores blanks', () => {
    expect(parseGlossary('Angels Delight TV\n\n  Sister Vanessa  \n')).toEqual(['Angels Delight TV', 'Sister Vanessa']);
  });
  it('protected terms survive translation unchanged', async () => {
    const g = applyGlossary(['Angels Delight TV'], ['Welcome to Angels Delight TV']);
    expect(g.texts[0]).not.toContain('Angels');
    const restored = g.restore(g.texts.map((t) => t.replace('Welcome to', 'Kaabo si')));
    expect(restored[0]).toBe('Kaabo si Angels Delight TV');
  });
  it('terms match whole words only', () => {
    const g = applyGlossary(['Ada'], ['Adamant Ada said hi', 'Canada']);
    expect(g.restore(g.texts)).toEqual(['Adamant Ada said hi', 'Canada']);
    expect(g.texts[0]).toContain('Adamant');
    expect(g.texts[1]).toBe('Canada');
  });
  it('keeps the longest term first so a short term inside a long one is not split', () => {
    const g = applyGlossary(['Delight', 'Angels Delight TV'], ['Angels Delight TV']);
    expect(g.restore(g.texts)).toEqual(['Angels Delight TV']);
  });
});
