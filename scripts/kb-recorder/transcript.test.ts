import { describe, expect, it } from 'vitest';
import {
  buildCards,
  buildStepBadges,
  chapterList,
  clock,
  remapMs,
  renderChaptersVtt,
  renderTranscript,
  skipSelectExpression,
} from './transcript';

describe('clock', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(63_400)).toBe('1:03');
    expect(clock(3_725_000)).toBe('1:02:05');
  });
});

describe('renderTranscript', () => {
  const text = renderTranscript({
    id: 'D02',
    title: 'Upload one video',
    audience: 'Editors',
    totalMs: 150_000,
    steps: [
      { n: 1, caption: 'Choose Upload in the side menu.', startMs: 3000, pointer: 'Upload' },
      { n: 2, caption: 'Drag your video onto the box.', startMs: 9000 },
    ],
  });
  it('has a heading, who it is for and the length', () => {
    expect(text.split('\n')[0]).toBe('Upload one video (D02)');
    expect(text).toContain('For Editors. 2 min 30 s.');
  });
  it('lists each step with its time and what the pointer does', () => {
    expect(text).toContain(
      '0:03  Choose Upload in the side menu.\n      The pointer moves to Upload.',
    );
    expect(text).toContain('0:09  Drag your video onto the box.');
    expect(text.match(/pointer moves/g)).toHaveLength(1);
  });
  it('has no dash of any kind', () => {
    expect(text).not.toMatch(
      new RegExp(`[-${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`),
    );
  });
});

describe('chapters', () => {
  const timings = [
    { caption: 'Choose Videos.', startMs: 1000, endMs: 4000, chapter: 'Find the list' },
    { caption: 'Click Edit.', startMs: 4000, endMs: 8000 },
    { caption: 'Type a title.', startMs: 8000, endMs: 12_000, chapter: 'Add details' },
  ];
  it('starts a chapter at each step that names one, and the first step always starts one', () => {
    expect(chapterList(timings)).toEqual([
      { startMs: 0, title: 'Find the list' },
      { startMs: 8000, title: 'Add details' },
    ]);
  });
  it('falls back to one chapter per step when no step names a chapter', () => {
    const c = chapterList(timings.map((t) => ({ ...t, chapter: undefined })));
    expect(c.map((x) => x.title)).toEqual(['Choose Videos.', 'Click Edit.', 'Type a title.']);
  });
  it('writes WebVTT chapters that cover the whole video without gaps', () => {
    const vtt = renderChaptersVtt(chapterList(timings), 14_000);
    expect(vtt).toBe(
      'WEBVTT\n\n00:00:00.000 --> 00:00:08.000\nFind the list\n\n00:00:08.000 --> 00:00:14.000\nAdd details\n',
    );
  });
});

describe('skipped waits', () => {
  const skips = [{ startMs: 10_000, endMs: 18_000 }];
  it('moves times after a skip earlier by its length and pins times inside it to its start', () => {
    expect(remapMs(5000, skips)).toBe(5000);
    expect(remapMs(12_000, skips)).toBe(10_000);
    expect(remapMs(20_000, skips)).toBe(12_000);
  });
  it('builds an ffmpeg select expression that drops the skipped seconds', () => {
    expect(skipSelectExpression(skips)).toBe("select='not(between(t,10.000,18.000))'");
    expect(skipSelectExpression([])).toBeNull();
  });
});

describe('badges and cards', () => {
  it('numbers steps as Step n of N for the fixed corner badge', () => {
    const b = buildStepBadges([
      { caption: 'A.', startMs: 0, endMs: 3000 },
      { caption: undefined, startMs: 3000, endMs: 4000 },
      { caption: 'B.', startMs: 4000, endMs: 7000 },
    ]);
    expect(b.map((x) => x.text)).toEqual(['Step 1 of 2', 'Step 2 of 2']);
  });

  it('makes a 3 second title card and a 3 second end card around the video', () => {
    const cards = buildCards({
      id: 'D02',
      title: 'Upload one video',
      audience: 'Editors',
      lengthLabel: '2 min 30 s',
      next: 'D03 Upload many videos',
      totalMs: 60_000,
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ startMs: 0, endMs: 3000 });
    expect(cards[0]!.lines).toEqual(['Upload one video', 'For Editors', '2 min 30 s']);
    expect(cards[1]).toMatchObject({ startMs: 63_000, endMs: 66_000 });
    expect(cards[1]!.lines).toEqual(['Next: D03 Upload many videos', 'D02']);
  });

  it('leaves out the end card when no article follows', () => {
    const cards = buildCards({
      id: 'D02',
      title: 'T',
      audience: 'Editors',
      lengthLabel: '1 min',
      totalMs: 1000,
    });
    expect(cards).toHaveLength(1);
  });
});
