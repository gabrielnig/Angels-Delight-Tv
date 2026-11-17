import { describe, expect, it } from 'vitest';
import { sniffContainer } from './magic';

const ascii = (text: string) => Buffer.from(text, 'latin1');
const ftyp = (brand: string) =>
  Buffer.concat([Buffer.from([0, 0, 0, 0x18]), ascii('ftyp'), ascii(brand), Buffer.alloc(16)]);

describe('sniffContainer', () => {
  it('recognises mp4 and quicktime by the ftyp box', () => {
    expect(sniffContainer(ftyp('isom'))).toBe('mp4');
    expect(sniffContainer(ftyp('qt  '))).toBe('mov');
  });
  it('recognises matroska and webm by the EBML header and doctype', () => {
    const ebml = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88]);
    expect(sniffContainer(Buffer.concat([ebml, ascii('matroska'), Buffer.alloc(8)]))).toBe(
      'matroska',
    );
    expect(sniffContainer(Buffer.concat([ebml, ascii('webm'), Buffer.alloc(8)]))).toBe('webm');
  });
  it('rejects everything else, including renamed files', () => {
    expect(sniffContainer(ascii('#EXTM3U\n#EXT-X-VERSION:3'))).toBeNull();
    expect(sniffContainer(ascii('MZ\x90\x00'))).toBeNull();
    expect(sniffContainer(Buffer.alloc(0))).toBeNull();
    expect(sniffContainer(ascii('<svg xmlns='))).toBeNull();
  });
});
