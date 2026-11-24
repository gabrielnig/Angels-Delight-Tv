import { describe, expect, it, vi } from 'vitest';
import { getTranslator, registerCatalogOverlay, registerMissingSink } from './server';

describe('getTranslator', () => {
  it('reads English for en', async () => {
    const t = await getTranslator('en');
    expect(t('format.duration.hr', { count: 2 })).toBe('2 hr');
  });
  it('puts approved database rows over an empty baseline and reports the rest as missing', async () => {
    registerCatalogOverlay(async () => new Map([['format.duration.hr', { status: 'approved' as const, text: '{count} wákàtí' }]]));
    const sink = vi.fn();
    registerMissingSink(sink);
    const t = await getTranslator('yo');
    expect(t('format.duration.hr', { count: 2 })).toBe('2 wákàtí');
    expect(t('format.duration.min', { count: 2 })).toBe('2 min');
    expect(sink).toHaveBeenCalledWith('yo', 'format.duration.min', expect.any(Object));
  });
});
