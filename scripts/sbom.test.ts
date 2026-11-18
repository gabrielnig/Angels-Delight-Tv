import { describe, expect, it } from 'vitest';
import { toCycloneDx } from './sbom.mjs';

const tree = [
  {
    name: 'web',
    version: '1.0.0',
    dependencies: {
      hls: { version: '1.7.4', dependencies: { shared: { version: '2.0.0' } } },
      '@scope/pkg': { version: '3.1.0' },
      '@ad/local': { version: 'link:../local' },
    },
  },
  { name: 'worker', version: '1.0.0', dependencies: { shared: { version: '2.0.0' } } },
];

describe('toCycloneDx', () => {
  const bom = toCycloneDx(tree, {
    name: 'angels-delight-tv',
    version: '0.1.0',
    timestamp: '2026-01-01T00:00:00Z',
  });

  it('is a CycloneDX 1.5 document with the app as the root component', () => {
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.5');
    expect(bom.metadata.component.name).toBe('angels-delight-tv');
  });

  it('lists each third party package once, with a purl, sorted', () => {
    expect(bom.components.map((c: { purl: string }) => c.purl)).toEqual([
      'pkg:npm/%40scope/pkg@3.1.0',
      'pkg:npm/hls@1.7.4',
      'pkg:npm/shared@2.0.0',
    ]);
  });

  it('leaves out workspace packages and is reproducible', () => {
    expect(JSON.stringify(bom)).not.toContain('local');
    expect(toCycloneDx(tree, { name: 'a', version: '1', timestamp: 't' })).toEqual(
      toCycloneDx(tree, { name: 'a', version: '1', timestamp: 't' }),
    );
  });
});
