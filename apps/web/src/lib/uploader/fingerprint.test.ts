import { validateUploadRequest } from '@ad/video';
import { describe, expect, it } from 'vitest';
import { laneFingerprint } from './engine';
import { fakeFile } from './fake-transport';

const LIMITS = { maxBytes: 5 * 1024 ** 3, partBytes: 8 * 1024 * 1024 };

const NAMES = [
  'copy_7B7CA63F-80F0-49B2-AFC3-05A3715D1698.mov',
  'IMG_0042.MOV',
  'My lesson (final) v2.mp4',
  'Lesson on faith: part 1.mp4',
  'Ọmọ ìyá wa, ẹ̀kọ́ 1.mp4',
  'video 2024-11-26 at 10.31.22.mov',
  `${'very long name '.repeat(14)}.mp4`,
  'a.mp4',
];

describe('laneFingerprint against the server rule', () => {
  it.each(NAMES)('is accepted by validateUploadRequest for %s', (name) => {
    const file = fakeFile(name, 3_456_789_012, 1_732_618_282_123);
    const fingerprint = laneFingerprint(file);
    expect(fingerprint).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    const valid = validateUploadRequest(
      {
        name: file.name,
        size: file.size,
        type: /\.mov$/i.test(name) ? 'video/quicktime' : 'video/mp4',
        fingerprint,
      },
      LIMITS,
    );
    expect(valid.fingerprint).toBe(fingerprint);
  });

  it('is stable for the same file and different for a different file', () => {
    const a = laneFingerprint(fakeFile('a.mp4', 10, 5));
    expect(laneFingerprint(fakeFile('a.mp4', 10, 5))).toBe(a);
    expect(laneFingerprint(fakeFile('b.mp4', 10, 5))).not.toBe(a);
    expect(laneFingerprint(fakeFile('a.mp4', 11, 5))).not.toBe(a);
    expect(laneFingerprint(fakeFile('a.mp4', 10, 6))).not.toBe(a);
  });

  it('keeps names that differ only in case, spacing or accents apart', () => {
    const set = new Set(
      ['a b.mp4', 'a  b.mp4', 'A b.mp4', 'á b.mp4'].map((n) => laneFingerprint(fakeFile(n, 1, 1))),
    );
    expect(set.size).toBe(4);
  });
});
