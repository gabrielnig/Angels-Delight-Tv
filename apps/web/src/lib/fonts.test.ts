import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: (options: { src: { path: string }[] }) => {
    const name = options.src[0]!.path.includes('space-grotesk')
      ? 'Space Grotesk'
      : options.src[0]!.path.includes('lora')
        ? 'Lora'
        : options.src[0]!.path.includes('poppins')
          ? 'Poppins'
          : 'Inter';
    return { className: `cls-${name}`, style: { fontFamily: `'${name}'` } };
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
