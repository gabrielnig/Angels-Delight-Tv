import { describe, expect, it } from 'vitest';
import { lintCaption, lintCues, wrapCaption } from './caption-style';

// Built from code points so this file holds no dash character itself.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const errors = (t: string) => lintCaption(t).errors;

describe('wrapCaption', () => {
  it('breaks at spaces into lines of at most 42 characters', () => {
    const t = 'Choose Videos in the side menu to see every video you have uploaded.';
    const wrapped = wrapCaption(t);
    expect(wrapped.split('\n').length).toBe(2);
    for (const l of wrapped.split('\n')) expect(l.length).toBeLessThanOrEqual(42);
    expect(wrapped.replace('\n', ' ')).toBe(t);
  });
  it('leaves a short caption on one line and balances two lines', () => {
    expect(wrapCaption('Choose Verify.')).toBe('Choose Verify.');
    const [a, b] = wrapCaption('Type the 6 digit code from your authenticator app now.').split(
      '\n',
    );
    expect(Math.abs(a!.length - b!.length)).toBeLessThan(20);
  });
});

describe('lintCaption errors', () => {
  it('accepts a plain step', () => {
    expect(lintCaption('Choose Videos in the side menu.').errors).toEqual([]);
  });
  it.each([
    ['em dash', `Open the page ${EM} then wait.`, /dash/],
    ['en dash', `Open 3${EN}4 videos.`, /dash/],
    ['hyphen', 'Open the two-step page.', /dash/],
    ['spaced hyphen', 'Open the page - then wait.', /dash/],
    ['emoji', 'Open the page \u{1F600}.', /emoji/i],
    ['exclamation mark', 'Open the page!', /exclamation/],
    ['no capital', 'open the page.', /capital/],
    ['no full stop', 'Open the page', /full stop/],
    ['all caps word', 'Open the SETTINGS page.', /capitals/i],
    ['jargon', 'Check the bitrate.', /bitrate/],
    ['two actions', 'Click Upload and then click Done.', /one action/],
    ['too many words', Array(26).fill('word').join(' ') + '.', /words/],
    ['too long for two lines', 'x'.repeat(30) + ' ' + 'y '.repeat(40) + 'z.', /two lines/],
    ['empty', '   ', /empty/],
  ])('rejects %s', (_n, text, pattern) => {
    expect(errors(text).join(' | ')).toMatch(pattern);
  });

  it('exempts a quoted or bold label from the jargon list but never from dashes', () => {
    expect(errors('Choose **Bitrate** in the menu.')).toEqual([]);
    expect(errors('Choose "Video quality" in the menu.')).toEqual([]);
    expect(errors('Choose "Two-step" in the menu.').join()).toMatch(/dash/);
  });

  it('allows short acronyms and product words', () => {
    expect(errors('Download the PDF.')).toEqual([]);
  });
});

describe('lintCaption warnings', () => {
  it('warns when a step does not start with a verb from the list', () => {
    expect(lintCaption('The menu is on the left.').warnings.join()).toMatch(/verb/);
    expect(lintCaption('Click Videos.').warnings).toEqual([]);
  });
  it('estimates the reading time', () => {
    expect(lintCaption('Choose Verify.').readingMs).toBe(2000);
  });
});

describe('lintCues', () => {
  const cue = (startMs: number, endMs: number, text: string) => ({ startMs, endMs, text });
  it('accepts cues of 2 to 6 seconds at 15 characters a second or slower', () => {
    expect(lintCues([cue(0, 3000, 'Choose Verify.')])).toEqual([]);
  });
  it('rejects a cue that is too short, too long or too fast', () => {
    expect(lintCues([cue(0, 1500, 'Hi.')]).join()).toMatch(/at least 2/);
    expect(lintCues([cue(0, 7000, 'Hi.')]).join()).toMatch(/at most 6/);
    expect(lintCues([cue(0, 3000, 'x'.repeat(70))]).join()).toMatch(/characters a second/);
  });
  it('rejects more than two lines or a line over 42 characters', () => {
    expect(lintCues([cue(0, 5000, 'a\nb\nc')]).join()).toMatch(/two lines/);
    expect(lintCues([cue(0, 5000, 'x'.repeat(43))]).join()).toMatch(/42/);
  });
});
