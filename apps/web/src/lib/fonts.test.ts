import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: (options: { src: { path: string }[]; preload?: boolean }) => {
    const file = options.src[0]!.path.split('/').pop()!.replace('.woff2', '');
    const family = file.startsWith('space-grotesk')
      ? 'Space Grotesk'
      : file.startsWith('dm-sans')
        ? 'DM Sans'
        : file.startsWith('lora')
          ? 'Lora'
          : file.startsWith('poppins')
            ? 'Poppins'
            : file.startsWith('nunito')
              ? 'Nunito'
              : 'Inter';
    return {
      className: `cls-${file}${options.preload === false ? '-lazy' : ''}`,
      style: { fontFamily: `'${family} ${file}'` },
    };
  },
}));

import { selectFonts } from './fonts';

describe('selectFonts', () => {
  it('loads Space Grotesk for headings and keeps Inter for body text by default', () => {
    const selected = selectFonts('space-grotesk');
    expect(selected.variables['--font-sans']).toContain('Inter');
    expect(selected.variables['--font-display']).toContain('Space Grotesk');
  });

  it('does not load Space Grotesk when another body font is picked', () => {
    const selected = selectFonts('poppins');
    expect(selected.variables['--font-display']).toBeUndefined();
    expect(selected.variables['--font-sans']).toContain('Poppins');
  });

  it('keeps Lora as a headings only serif', () => {
    expect(selectFonts('lora').variables['--font-display']).toContain('Lora');
  });
});

const fontsDir = resolve(import.meta.dirname, '../fonts');
const manifest = JSON.parse(readFileSync(resolve(fontsDir, 'coverage.json'), 'utf8')) as {
  sets: Record<string, string>;
  files: Record<string, { sha256: string; codepoints: number[] }>;
};

describe('font files (R23, M47-S11)', () => {
  const families = ['inter', 'space-grotesk', 'dm-sans', 'nunito', 'lora', 'poppins'];
  const hasVietnamese = ['inter', 'space-grotesk', 'nunito', 'lora'];

  it('each family ships latin and latin-ext, and vietnamese where upstream has one', () => {
    for (const family of families) {
      const files = Object.keys(manifest.files).filter((f) => f.startsWith(`${family}-`));
      expect(
        files.some((f) => f.includes('-latin-') && !f.includes('latin-ext')),
        family,
      ).toBe(true);
      expect(
        files.some((f) => f.includes('latin-ext')),
        family,
      ).toBe(true);
      expect(
        files.some((f) => f.includes('vietnamese')),
        family,
      ).toBe(hasVietnamese.includes(family));
    }
  });

  it('the coverage manifest matches the shipped files', () => {
    for (const [name, entry] of Object.entries(manifest.files)) {
      expect(existsSync(resolve(fontsDir, name)), name).toBe(true);
      const hash = createHash('sha256')
        .update(readFileSync(resolve(fontsDir, name)))
        .digest('hex');
      expect(hash, `${name}: rerun python3 scripts/font-coverage.py`).toBe(entry.sha256);
    }
  });

  /** Glyphs the stack of a family cannot draw, NFD aware: precomposed, or every piece of the decomposed form. */
  function gaps(prefixes: string[]): Record<string, string[]> {
    const have = new Set<number>();
    for (const [name, entry] of Object.entries(manifest.files)) {
      if (prefixes.some((p) => name.startsWith(p))) entry.codepoints.forEach((cp) => have.add(cp));
    }
    const out: Record<string, string[]> = {};
    for (const [set, chars] of Object.entries(manifest.sets)) {
      for (const word of chars.split(' ')) {
        const whole = [...word].every((c) => have.has(c.codePointAt(0)!));
        const parts = [...word.normalize('NFD')].every((c) => have.has(c.codePointAt(0)!));
        if (!whole && !parts) (out[set] ??= []).push(word);
      }
    }
    return out;
  }

  const INTER_FALLBACK = ['inter-latin-ext', 'inter-vietnamese'];

  it('Inter, the override family, draws every Yoruba, Igbo, Hausa and naira glyph', () => {
    expect(gaps(['inter-'])).toEqual({});
  });

  it('every family stack draws Yoruba and Igbo, including DM Sans and Poppins through Inter', () => {
    for (const family of ['space-grotesk', 'nunito', 'lora']) {
      const found = gaps([`${family}-`]);
      expect(found.yoruba, family).toBeUndefined();
      expect(
        (found.igbo ?? []).filter((g) => !/ṅ|Ṅ/.test(g)),
        family,
      ).toEqual([]);
    }
    for (const family of ['dm-sans', 'poppins']) {
      expect(gaps([`${family}-`, ...INTER_FALLBACK]), family).toEqual({});
    }
  });

  it('pins the Hausa, naira and Igbo gaps so a new gap or a closed gap fails the test', () => {
    expect(gaps(['space-grotesk-']).hausa).toEqual(['ɓ', 'ɗ', 'ƙ', 'ƴ', 'Ɓ', 'Ɗ', 'Ƙ', 'Ƴ']);
    expect(gaps(['nunito-'])).toEqual({ hausa: ['ƙ', 'Ƙ'] });
    expect(gaps(['lora-'])).toEqual({
      igbo: ['ṅ', 'Ṅ'],
      hausa: ['ɓ', 'ɗ', 'ƙ', 'ƴ', 'Ɓ', 'Ɗ', 'Ƙ', 'Ƴ'],
      naira: ['₦'],
    });
    expect(Object.keys(gaps(['dm-sans-'])).sort()).toEqual(['hausa', 'igbo', 'naira', 'yoruba']);
    expect(Object.keys(gaps(['poppins-'])).sort()).toEqual(['hausa', 'igbo', 'naira', 'yoruba']);
  });
});

describe('selectFonts stacks and the language rule (R23)', () => {
  it('lists latin, latin-ext and vietnamese faces before the system fallback', () => {
    const sans = selectFonts('inter').variables['--font-sans']!;
    const order = ['inter-latin-wght', 'inter-latin-ext', 'inter-vietnamese'].map((f) =>
      sans.indexOf(f),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(sans.indexOf('system-ui')).toBeGreaterThan(order[2]!);
  });

  it('does not preload the ext and vietnamese faces', () => {
    const { classNames } = selectFonts('nunito');
    expect(classNames).toContain('cls-nunito-latin-ext-wght-normal-lazy');
    expect(classNames).toContain('cls-nunito-vietnamese-wght-normal-lazy');
    expect(classNames).not.toContain('cls-nunito-latin-wght-normal-lazy');
  });

  it('DM Sans and Poppins end in the Inter ext and vietnamese faces', () => {
    for (const key of ['dm-sans', 'poppins'] as const) {
      const sans = selectFonts(key).variables['--font-sans']!;
      expect(sans).toContain('inter-latin-ext');
      expect(sans).toContain('inter-vietnamese');
      expect(sans).not.toContain('inter-latin-wght');
    }
  });

  it.each(['yo', 'ig', 'ha'])('headings use Inter for lang %s', (lang) => {
    const display = selectFonts('lora', lang).variables['--font-display']!;
    expect(display).toContain('inter-latin-wght');
    expect(display).not.toContain('Lora');
    expect(selectFonts('space-grotesk', lang).variables['--font-display']).not.toContain(
      'Space Grotesk',
    );
  });

  it('English keeps the selected display family and loads no extra Inter faces for Nunito', () => {
    expect(selectFonts('lora', 'en').variables['--font-display']).toContain('Lora');
    expect(selectFonts('nunito', 'en').variables['--font-sans']).not.toContain('inter-');
  });
});
