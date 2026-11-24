export function parseGlossary(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Swap protected terms for opaque tokens before translation and back after. */
export function applyGlossary(terms: string[], texts: string[]) {
  const sorted = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const tokens: string[] = [];
  const texts2 = texts.map((text) => {
    let out = text;
    for (const term of sorted) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(term)}(?![\\p{L}\\p{N}])`, 'gu');
      out = out.replace(re, () => {
        tokens.push(term);
        return `[[${tokens.length - 1}]]`;
      });
    }
    return out;
  });
  return {
    texts: texts2,
    restore: (translated: string[]) =>
      translated.map((t) => t.replace(/\[\[\s*(\d+)\s*\]\]/g, (m, i) => tokens[Number(i)] ?? m)),
  };
}
