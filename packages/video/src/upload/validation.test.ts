import { ValidationFailed } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import {
  choosePartSize,
  sanitizeFilename,
  slugFromTitle,
  titleFromFilename,
  validateUploadRequest,
  type UploadLimits,
} from './validation';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const limits: UploadLimits = { maxBytes: 5 * GIB, partBytes: 8 * MIB };

const base = {
  name: 'Lesson_01.mp4',
  size: 100 * MIB,
  type: 'video/mp4',
  fingerprint: 'abcdefgh12345678',
};

describe('validateUploadRequest', () => {
  it('accepts a normal mp4 and normalises the extension', () => {
    expect(validateUploadRequest({ ...base, name: 'LESSON.MP4' }, limits)).toMatchObject({
      filename: 'LESSON.MP4',
      extension: 'mp4',
    });
  });

  it('accepts mkv and mov with the empty or generic MIME browsers send', () => {
    expect(validateUploadRequest({ ...base, name: 'a.mkv', type: '' }, limits).extension).toBe(
      'mkv',
    );
    expect(
      validateUploadRequest({ ...base, name: 'a.mov', type: 'application/octet-stream' }, limits)
        .extension,
    ).toBe('mov');
  });

  function failure(input: Partial<typeof base>) {
    try {
      validateUploadRequest({ ...base, ...input }, limits);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailed);
      return (error as ValidationFailed).fields;
    }
    throw new Error('expected a validation failure');
  }

  it('rejects files over the limit with the limit in the message (M13-S07 AC1)', () => {
    expect(failure({ size: 5 * GIB + 1 }).size?.[0]).toMatch(/5 GB/);
  });
  it('rejects zero or fractional sizes', () => {
    expect(failure({ size: 0 }).size).toBeDefined();
    expect(failure({ size: 1.5 }).size).toBeDefined();
  });
  it('rejects a wrong extension or MIME (M13-S07 AC2)', () => {
    expect(failure({ name: 'virus.exe' }).name?.[0]).toMatch(/MP4, MOV, MKV or WebM/);
    expect(failure({ name: 'noextension' }).name).toBeDefined();
    expect(failure({ type: 'image/png' }).type).toBeDefined();
  });
  it('rejects a bad fingerprint', () => {
    expect(failure({ fingerprint: 'x' }).fingerprint).toBeDefined();
    expect(failure({ fingerprint: 'has spaces and ../' }).fingerprint).toBeDefined();
  });
});

describe('sanitizeFilename', () => {
  it('drops paths and control characters and keeps the name readable', () => {
    expect(sanitizeFilename('C:\\videos\\..\\my lesson.mp4')).toBe('my lesson.mp4');
    expect(sanitizeFilename('a\u0000b\nc.mp4')).toBe('abc.mp4');
    expect(sanitizeFilename('x'.repeat(400) + '.mp4').length).toBeLessThanOrEqual(255);
  });
});

describe('titleFromFilename', () => {
  it('removes the extension, turns underscores into spaces and trims (M13-S09 edge)', () => {
    expect(titleFromFilename('  Intro_to_Algebra_part_1.MP4 ')).toBe('Intro to Algebra part 1');
    expect(titleFromFilename('.mp4')).toBe('Untitled video');
    expect(titleFromFilename('a'.repeat(300) + '.mp4').length).toBe(200);
  });
});

describe('slugFromTitle', () => {
  it('builds a valid, unique looking slug', () => {
    const slug = slugFromTitle('Intro to Algebra!', () => new Uint8Array([1, 2, 3, 4]));
    expect(slug).toMatch(/^intro-to-algebra-[a-z2-7]+$/);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('falls back for titles with no latin letters and respects the length limit', () => {
    expect(slugFromTitle('!!!', () => new Uint8Array([1, 2, 3, 4]))).toMatch(/^video-[a-z2-7]+$/);
    expect(
      slugFromTitle('a'.repeat(300), () => new Uint8Array([1, 2, 3, 4])).length,
    ).toBeLessThanOrEqual(120);
  });
});

describe('choosePartSize', () => {
  it('uses the configured part size when the file fits in 10,000 parts', () => {
    expect(choosePartSize(1 * GIB, 8 * MIB)).toBe(8 * MIB);
  });
  it('raises the part size in whole MiB for very large files', () => {
    const size = 100 * GIB;
    const part = choosePartSize(size, 8 * MIB);
    expect(part % MIB).toBe(0);
    expect(Math.ceil(size / part)).toBeLessThanOrEqual(10_000);
  });
});
