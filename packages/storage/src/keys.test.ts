import { describe, expect, it } from 'vitest';
import { assertSafeKey } from './keys';

describe('assertSafeKey', () => {
  it('accepts normal object keys', () => {
    expect(() => assertSafeKey('originals/abc/def')).not.toThrow();
    expect(() => assertSafeKey('v/abcdef/720/seg_00001.ts')).not.toThrow();
  });

  it.each([
    ['empty', ''],
    ['parent traversal', 'a/../b'],
    ['leading parent traversal', '../etc/passwd'],
    ['absolute path', '/etc/passwd'],
    ['backslash', 'a\\b'],
    ['null byte', 'a\0b'],
    ['empty segment', 'a//b'],
    ['dot segment', 'a/./b'],
    ['trailing slash', 'a/b/'],
  ])('rejects %s', (_label, key) => {
    expect(() => assertSafeKey(key)).toThrow(/object key/i);
  });

  it('rejects keys longer than 1024 bytes', () => {
    expect(() => assertSafeKey('a'.repeat(1025))).toThrow(/object key/i);
  });
});
