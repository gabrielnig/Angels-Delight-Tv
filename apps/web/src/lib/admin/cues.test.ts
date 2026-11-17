import { describe, expect, it } from 'vitest';
import {
  changesSinceApproval,
  createHistory,
  findActiveCue,
  findReplace,
  formatTimestamp,
  mergeCues,
  parseTimestamp,
  parseVtt,
  redo,
  splitCue,
  toVtt,
  undo,
  push,
  validateCues,
} from './cues';
import type { Cue } from './cues';

const cue = (id: string, start: number, end: number, text: string): Cue => ({
  id,
  start,
  end,
  text,
});

describe('timestamps', () => {
  it('parses mm:ss.mmm, h:mm:ss.mmm and short forms', () => {
    expect(parseTimestamp('01:04.200')).toBe(64_200);
    expect(parseTimestamp('1:01:04.200')).toBe(3_664_200);
    expect(parseTimestamp('64.2')).toBe(64_200);
    expect(parseTimestamp('1:04')).toBe(64_000);
  });
  it('rejects nonsense', () => {
    for (const bad of ['', 'abc', '1:2:3:4', '-1', '1:75.0'])
      expect(parseTimestamp(bad)).toBeNull();
  });
  it('formats back', () => {
    expect(formatTimestamp(64_200)).toBe('01:04.200');
    expect(formatTimestamp(3_664_200)).toBe('1:01:04.200');
    expect(formatTimestamp(0)).toBe('00:00.000');
  });
});

describe('validateCues', () => {
  it('flags overlap, too long, empty and bad timing, and leaves good cues clean', () => {
    const cues = [
      cue('a', 0, 3000, 'Fine.'),
      cue('b', 2900, 5000, 'Overlaps the one before.'),
      cue('c', 5100, 8000, 'x'.repeat(91)),
      cue('d', 8100, 9000, ''),
      cue('e', 9500, 9500, 'Zero length'),
    ];
    const warnings = validateCues(cues);
    expect(warnings.get('a')).toBeUndefined();
    expect(warnings.get('b')).toEqual(['overlap']);
    expect(warnings.get('c')).toEqual(['too_long']);
    expect(warnings.get('d')).toEqual(['empty']);
    expect(warnings.get('e')).toEqual(['bad_timing']);
  });
});

describe('findActiveCue', () => {
  const cues = [cue('a', 0, 1000, 'a'), cue('b', 1100, 2000, 'b'), cue('c', 3000, 4000, 'c')];
  it('finds the cue playing now', () => {
    expect(findActiveCue(cues, 500)).toBe(0);
    expect(findActiveCue(cues, 1100)).toBe(1);
    expect(findActiveCue(cues, 3999)).toBe(2);
  });
  it('returns -1 in a gap or outside', () => {
    expect(findActiveCue(cues, 1050)).toBe(-1);
    expect(findActiveCue(cues, 2500)).toBe(-1);
    expect(findActiveCue(cues, 9000)).toBe(-1);
  });
});

describe('split and merge', () => {
  it('splits text at a character position and shares the time by length', () => {
    const [a, b] = splitCue(cue('x', 0, 4000, 'Hello there friend'), 5, (n) => `${n}`);
    expect(a).toMatchObject({ id: 'x', start: 0, text: 'Hello' });
    expect(b!.text).toBe('there friend');
    expect(a!.end).toBe(b!.start - 100);
    expect(b!.end).toBe(4000);
    expect(a!.end).toBeGreaterThan(0);
  });
  it('will not split at the very start or end', () => {
    expect(splitCue(cue('x', 0, 4000, 'Hello'), 0, () => 'n')).toHaveLength(1);
    expect(splitCue(cue('x', 0, 4000, 'Hello'), 5, () => 'n')).toHaveLength(1);
  });
  it('merges two cues into one spanning both', () => {
    expect(mergeCues(cue('a', 0, 1000, 'One'), cue('b', 1100, 2000, 'two'))).toEqual({
      id: 'a',
      start: 0,
      end: 2000,
      text: 'One two',
    });
  });
});

describe('findReplace', () => {
  const cues = [
    cue('a', 0, 1, 'Password rules'),
    cue('b', 2, 3, 'a strong password'),
    cue('c', 4, 5, 'nothing'),
  ];
  it('replaces all matches ignoring case by default and counts them', () => {
    const result = findReplace(cues, 'password', 'passphrase', {});
    expect(result.count).toBe(2);
    expect(result.cues.map((c) => c.text)).toEqual([
      'passphrase rules',
      'a strong passphrase',
      'nothing',
    ]);
  });
  it('can match case and treats the search as plain text', () => {
    expect(findReplace(cues, 'Password', 'X', { matchCase: true }).count).toBe(1);
    expect(findReplace([cue('a', 0, 1, 'a.b a+b')], '.', '!', {}).cues[0]!.text).toBe('a!b a+b');
  });
  it('does nothing for an empty search', () => {
    expect(findReplace(cues, '', 'x', {}).count).toBe(0);
  });
});

describe('history', () => {
  it('undoes and redoes, and a new edit drops the redo branch', () => {
    let h = createHistory([1]);
    h = push(h, [1, 2]);
    h = push(h, [1, 2, 3]);
    h = undo(h);
    expect(h.present).toEqual([1, 2]);
    h = redo(h);
    expect(h.present).toEqual([1, 2, 3]);
    h = undo(undo(h));
    h = push(h, [9]);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toEqual([9]);
    expect(undo(undo(undo(h))).present).toEqual([1]);
  });
});

describe('changesSinceApproval', () => {
  it('counts cues whose words or timing differ, plus added and removed ones', () => {
    const approved = [cue('a', 0, 1000, 'One'), cue('b', 1100, 2000, 'Two')];
    expect(changesSinceApproval(approved, approved)).toBe(0);
    expect(
      changesSinceApproval(approved, [cue('a', 0, 1000, 'One!'), cue('b', 1100, 2000, 'Two')]),
    ).toBe(1);
    expect(changesSinceApproval(approved, [cue('a', 0, 1000, 'One')])).toBe(1);
    expect(changesSinceApproval(approved, [...approved, cue('c', 2100, 3000, 'Three')])).toBe(1);
  });
});

describe('vtt', () => {
  const cues = [cue('a', 1000, 3500, 'Hello.'), cue('b', 3600, 5000, 'Line one\nLine two')];
  it('writes WebVTT', () => {
    expect(toVtt(cues)).toBe(
      'WEBVTT\n\n1\n00:01.000 --> 00:03.500\nHello.\n\n2\n00:03.600 --> 00:05.000\nLine one\nLine two\n',
    );
  });
  it('reads it back', () => {
    const parsed = parseVtt(toVtt(cues), (n) => `c${n}`);
    expect(parsed.ok && parsed.cues.map(({ start, end, text }) => ({ start, end, text }))).toEqual(
      cues.map(({ start, end, text }) => ({ start, end, text })),
    );
  });
  it('accepts hour stamps and comma milliseconds', () => {
    const parsed = parseVtt('WEBVTT\n\n00:00:01,000 --> 00:00:02,000\nHi\n', (n) => `c${n}`);
    expect(parsed.ok && parsed.cues[0]).toMatchObject({ start: 1000, end: 2000, text: 'Hi' });
  });
  it('explains a file that is not captions', () => {
    expect(parseVtt('hello', (n) => `${n}`)).toEqual({
      ok: false,
      error: 'That does not look like a caption file. Use a .vtt file.',
    });
    expect(parseVtt('WEBVTT\n\n', (n) => `${n}`)).toEqual({
      ok: false,
      error: 'That caption file has no cues in it.',
    });
  });
});
