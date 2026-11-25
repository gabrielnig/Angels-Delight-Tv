import { describe, expect, it } from 'vitest';
import {
  buildCues,
  formatTimestamp,
  parseCues,
  parseTimestamp,
  readingTimeMs,
  toAss,
  toSrt,
  toVtt,
  validateCues,
} from './captions';

describe('parseTimestamp', () => {
  it('reads hours, minutes, seconds and milliseconds with a dot or a comma', () => {
    expect(parseTimestamp('00:00:01.500')).toBe(1500);
    expect(parseTimestamp('01:02:03,250')).toBe(3_723_250);
  });
  it('reads the short WebVTT form without hours', () => {
    expect(parseTimestamp('01:05.040')).toBe(65_040);
  });
  it('rejects anything else', () => {
    expect(() => parseTimestamp('1.5')).toThrow(/timestamp/i);
    expect(() => parseTimestamp('00:61:00.000')).toThrow(/timestamp/i);
    expect(() => parseTimestamp('')).toThrow(/timestamp/i);
  });
});

describe('formatTimestamp', () => {
  it('writes WebVTT with a dot and SRT with a comma', () => {
    expect(formatTimestamp(3_723_250, '.')).toBe('01:02:03.250');
    expect(formatTimestamp(1500, ',')).toBe('00:00:01,500');
  });
  it('rounds to whole milliseconds and never goes negative', () => {
    expect(formatTimestamp(1499.6, '.')).toBe('00:00:01.500');
    expect(formatTimestamp(-5, '.')).toBe('00:00:00.000');
  });
});

const VTT = `WEBVTT

NOTE this is a comment
and it spans two lines

intro
00:00:01.000 --> 00:00:03.500 align:center
Open the Videos page.

00:00:04.000 --> 00:00:06.000
Choose a video.
It opens in the editor.
`;

describe('parseCues', () => {
  it('parses WebVTT with notes, identifiers, settings and multi line text', () => {
    expect(parseCues(VTT)).toEqual([
      { startMs: 1000, endMs: 3500, text: 'Open the Videos page.' },
      { startMs: 4000, endMs: 6000, text: 'Choose a video.\nIt opens in the editor.' },
    ]);
  });
  it('parses SRT with numbers, comma timestamps and CRLF line endings', () => {
    const srt =
      '1\r\n00:00:00,500 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:02,500 --> 00:00:04,000\r\nWorld\r\n';
    expect(parseCues(srt)).toEqual([
      { startMs: 500, endMs: 2000, text: 'Hello' },
      { startMs: 2500, endMs: 4000, text: 'World' },
    ]);
  });
  it('returns no cues for an empty file and throws on a broken timing line', () => {
    expect(parseCues('WEBVTT\n')).toEqual([]);
    expect(() => parseCues('WEBVTT\n\n00:00:01.000 -> 00:00:02.000\nx\n')).toThrow(/timing/i);
  });
});

describe('validateCues', () => {
  it('accepts ordered, non overlapping cues', () => {
    expect(validateCues(parseCues(VTT))).toEqual([]);
  });
  it('reports empty text, zero length, going backwards and overlap', () => {
    const problems = validateCues([
      { startMs: 0, endMs: 2000, text: 'a' },
      { startMs: 1500, endMs: 3000, text: 'b' },
      { startMs: 3000, endMs: 3000, text: 'c' },
      { startMs: 2000, endMs: 2500, text: ' ' },
    ]);
    expect(problems.join('|')).toMatch(/overlaps/);
    expect(problems.join('|')).toMatch(/ends before it starts|zero length/);
    expect(problems.join('|')).toMatch(/empty/);
    expect(problems.join('|')).toMatch(/out of order/);
  });
});

describe('writers', () => {
  const cues = [
    { startMs: 1000, endMs: 3500, text: 'Open the Videos page.' },
    { startMs: 4000, endMs: 6000, text: 'Choose a video.\nIt opens.' },
  ];
  it('writes WebVTT that parses back to the same cues', () => {
    const vtt = toVtt(cues);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(parseCues(vtt)).toEqual(cues);
  });
  it('writes SRT that parses back to the same cues', () => {
    const srt = toSrt(cues);
    expect(srt.startsWith('1\n00:00:01,000 --> 00:00:03,500\n')).toBe(true);
    expect(parseCues(srt)).toEqual(cues);
  });
  it('writes ASS sized in real pixels with safe margins and the timings in centiseconds', () => {
    const ass = toAss(cues, {
      width: 1280,
      height: 720,
      fontSize: 40,
      marginX: 80,
      marginV: 60,
      fontName: 'Inter',
    });
    expect(ass).toMatch(/PlayResX: 1280/);
    expect(ass).toMatch(/PlayResY: 720/);
    expect(ass).toMatch(/Style: Caption,Inter,40,/);
    expect(ass).toMatch(/,80,80,60,1$/m);
    expect(ass).toContain(
      'Dialogue: 0,0:00:01.00,0:00:03.50,Caption,,0,0,0,,Open the Videos page.',
    );
    expect(ass).toContain('Choose a video.\\NIt opens.');
  });
  it('escapes ASS control characters in caption text', () => {
    const ass = toAss([{ startMs: 0, endMs: 1000, text: 'a {b} c' }], {
      width: 1280,
      height: 720,
      fontSize: 40,
      marginX: 80,
      marginV: 60,
      fontName: 'Inter',
    });
    expect(ass).not.toContain('{b}');
  });
});

describe('buildCues', () => {
  it('turns measured step timings into cues, dropping steps without a caption', () => {
    const cues = buildCues(
      [
        { caption: 'First', startMs: 500, endMs: 2500 },
        { caption: undefined, startMs: 2500, endMs: 3000 },
        { caption: 'Second', startMs: 3000, endMs: 5000 },
      ],
      { leadMs: 100, minMs: 1500 },
    );
    expect(cues).toEqual([
      { startMs: 600, endMs: 2500, text: 'First' },
      { startMs: 3100, endMs: 5000, text: 'Second' },
    ]);
  });
  it('stretches a short cue to the minimum reading time without overlapping the next one', () => {
    const cues = buildCues(
      [
        { caption: 'Quick', startMs: 0, endMs: 400 },
        { caption: 'Next', startMs: 1000, endMs: 3000 },
      ],
      { leadMs: 0, minMs: 1500 },
    );
    expect(cues[0]).toEqual({ startMs: 0, endMs: 1000, text: 'Quick' });
    expect(validateCues(cues)).toEqual([]);
  });
});

describe('readingTimeMs', () => {
  it('gives short captions a two second floor and long ones about 55 ms per character', () => {
    expect(readingTimeMs('Hi')).toBe(2000);
    expect(readingTimeMs('x'.repeat(60))).toBe(400 + 60 * 55);
  });
  it('counts every line of a two line caption', () => {
    expect(readingTimeMs('a'.repeat(40) + '\n' + 'b'.repeat(40))).toBe(400 + 80 * 55);
  });
});
