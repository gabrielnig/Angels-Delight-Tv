import { describe, expect, it } from 'vitest';
import {
  VttError,
  cuesFromWords,
  findReplace,
  parseSrt,
  parseVtt,
  sanitizeCueText,
  serializeVtt,
  validateCues,
} from './vtt';

describe('serializeVtt and parseVtt', () => {
  const cues = [
    { startMs: 0, endMs: 2500, text: 'Hello there.' },
    { startMs: 3_661_005, endMs: 3_665_000, text: 'Second line\nof text' },
  ];

  it('round trips with hour formatting only when needed', () => {
    const text = serializeVtt(cues);
    expect(text.startsWith('WEBVTT\n\n')).toBe(true);
    expect(text).toContain('00:00.000 --> 00:02.500');
    expect(text).toContain('01:01:01.005 --> 01:01:05.000');
    expect(parseVtt(text)).toEqual(cues);
  });

  it('ignores NOTE blocks and cue identifiers and accepts BOM and CRLF', () => {
    const source =
      '﻿WEBVTT - title\r\n\r\nNOTE a comment\r\n\r\nintro\r\n00:01.000 --> 00:02.000 align:start\r\nHi\r\n';
    expect(parseVtt(source)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('reports the line number and reason for a bad file', () => {
    expect(() => parseVtt('not a vtt')).toThrow(VttError);
    try {
      parseVtt('WEBVTT\n\n00:01.000 --> nonsense\nHi\n');
    } catch (error) {
      expect(error).toBeInstanceOf(VttError);
      expect((error as VttError).line).toBe(3);
    }
  });

  it('strips unsafe markup on parse, keeping b, i and u', () => {
    const parsed = parseVtt(
      'WEBVTT\n\n00:00.000 --> 00:01.000\n<b>Bold</b> <script>alert(1)</script><c.red>x</c>\n',
    );
    expect(parsed[0]?.text).toBe('<b>Bold</b> alert(1)x');
  });
});

describe('sanitizeCueText', () => {
  it('escapes stray angle brackets and bare ampersands', () => {
    expect(sanitizeCueText('a < b & c &amp; d')).toBe('a &lt; b &amp; c &amp; d');
  });
  it('drops attributes on allowed tags', () => {
    expect(sanitizeCueText('<i onclick="x">hi</i>')).toBe('<i>hi</i>');
  });
});

describe('parseSrt', () => {
  it('converts comma milliseconds and renumbers', () => {
    const srt =
      '1\n00:00:01,000 --> 00:00:03,500\nFirst\n\n2\n00:00:04,000 --> 00:00:05,000\nSecond\nline\n';
    expect(parseSrt(srt)).toEqual([
      { startMs: 1000, endMs: 3500, text: 'First' },
      { startMs: 4000, endMs: 5000, text: 'Second\nline' },
    ]);
  });
  it('rejects a bad timing line with its line number', () => {
    expect(() => parseSrt('1\n00:00:01 --> x\nHi')).toThrow(/line 2/);
  });
});

describe('cuesFromWords', () => {
  const words = (text: string, startMs: number, stepMs: number) =>
    text.split(' ').map((word, i) => ({
      word,
      startMs: startMs + i * stepMs,
      endMs: startMs + (i + 1) * stepMs - 50,
    }));

  it('wraps to two lines of at most 42 characters and keeps cues between 1 and 7 seconds', () => {
    const text =
      'The quick brown fox jumps over the lazy dog while the sun sets slowly behind the distant green hills and everyone goes home';
    const cues = cuesFromWords(words(text, 0, 400));
    expect(cues.length).toBeGreaterThan(1);
    for (const cue of cues) {
      const lines = cue.text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(42);
      expect(cue.endMs - cue.startMs).toBeLessThanOrEqual(7000);
      expect(cue.endMs - cue.startMs).toBeGreaterThanOrEqual(1000);
    }
    expect(cues.map((cue) => cue.text.replace(/\n/g, ' ')).join(' ')).toBe(text);
  });

  it('splits at a long silence and never overlaps the next cue', () => {
    const cues = cuesFromWords([
      { word: 'Hello', startMs: 0, endMs: 300 },
      { word: 'again', startMs: 6000, endMs: 6400 },
    ]);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.endMs).toBeLessThanOrEqual(cues[1]!.startMs);
  });

  it('returns no cues for no words', () => {
    expect(cuesFromWords([])).toEqual([]);
  });
});

describe('validateCues', () => {
  it('flags overlaps, empty cues, long cues and long lines', () => {
    const warnings = validateCues([
      { startMs: 0, endMs: 3000, text: 'ok' },
      { startMs: 2500, endMs: 4000, text: '' },
      { startMs: 5000, endMs: 13000, text: 'a'.repeat(50) },
    ]);
    expect(warnings.map((w) => w.kind).sort()).toEqual([
      'empty',
      'line_too_long',
      'overlap',
      'too_long',
    ]);
    expect(validateCues([{ startMs: 0, endMs: 1000, text: 'fine' }])).toEqual([]);
  });
  it('flags a cue that ends before it starts', () => {
    expect(validateCues([{ startMs: 2000, endMs: 1000, text: 'x' }])[0]?.kind).toBe(
      'end_before_start',
    );
  });
});

describe('findReplace', () => {
  it('counts and replaces case insensitively by default, or exactly with matchCase', () => {
    const cues = [{ startMs: 0, endMs: 1000, text: 'Lagos and lagos' }];
    expect(findReplace(cues, 'lagos', 'Abuja')).toEqual({
      count: 2,
      cues: [{ startMs: 0, endMs: 1000, text: 'Abuja and Abuja' }],
    });
    expect(findReplace(cues, 'lagos', 'Abuja', { matchCase: true }).count).toBe(1);
    expect(findReplace(cues, 'nothing', 'x').count).toBe(0);
  });
  it('treats the search text literally', () => {
    const cues = [{ startMs: 0, endMs: 1000, text: 'a.b (c)' }];
    expect(findReplace(cues, '.', '-').cues[0]?.text).toBe('a-b (c)');
  });
});
