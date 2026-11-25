import { describe, expect, it } from 'vitest';
import { resolvePdfSource } from './pdf';

describe('resolvePdfSource (M50-S09 per article PDF)', () => {
  it('reads help/<release>/pdf/<id>.pdf from private storage', () => {
    expect(resolvePdfSource('v1.0.0', 'D02.pdf')).toEqual({
      kind: 'storage',
      key: 'help/v1.0.0/pdf/D02.pdf',
    });
  });

  it('has no prebuilt files in the sample release', () => {
    expect(resolvePdfSource('sample', 'D02.pdf')).toBeNull();
  });

  it('refuses names that are not an article id with .pdf', () => {
    expect(resolvePdfSource('v1.0.0', '../D02.pdf')).toBeNull();
    expect(resolvePdfSource('v1.0.0', 'D2.pdf')).toBeNull();
    expect(resolvePdfSource('v1.0.0', 'D02.exe')).toBeNull();
  });
});
