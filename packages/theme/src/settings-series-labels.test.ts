import { describe, expect, it } from 'vitest';
import { SETTING_DEFS } from './settings-registry';

const def = SETTING_DEFS['content.series_labels'];

describe('content.series_labels setting (M51)', () => {
  it('defaults to Season and Episode and is public for admins to change', () => {
    expect(def.default).toEqual({ preset: 'season_episode' });
    expect(def.isPublic).toBe(true);
    expect(def.tier).toBe('admin');
    expect(def.group).toBe('content');
  });

  it('accepts presets and custom words', () => {
    expect(def.schema.safeParse({ preset: 'book_chapter', code: 'Ch' }).success).toBe(true);
    expect(
      def.schema.safeParse({
        preset: 'custom',
        custom: { group: { one: 'Book', other: 'Books' }, item: { one: 'Chapter', other: 'Chapters' } },
      }).success,
    ).toBe(true);
  });

  it('refuses markup, missing custom words and unknown presets', () => {
    expect(def.schema.safeParse({ preset: 'nope' }).success).toBe(false);
    expect(def.schema.safeParse({ preset: 'custom' }).success).toBe(false);
    expect(
      def.schema.safeParse({
        preset: 'custom',
        custom: { group: { one: '<b>x', other: 'Books' }, item: { one: 'Chapter', other: 'Chapters' } },
      }).success,
    ).toBe(false);
  });
});
