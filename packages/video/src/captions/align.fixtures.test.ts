import { describe, expect, it } from 'vitest';
import { alignScript, cuesFromAlignment } from './align';

const APOS = String.fromCharCode(0x2019);
const E_ACUTE = String.fromCharCode(0xe9);

/** A narrated lesson: each recognised word gets 300 ms of speech and a 100 ms gap, probability 0.95. */
function heard(text: string, offset = 0, probability = 0.95) {
  return text.split(' ').map((word, i) => ({
    word,
    startMs: offset + i * 400,
    endMs: offset + i * 400 + 300,
    confidence: probability,
  }));
}

const LESSON =
  'Welcome to the lesson. Today we learn about fractions. A fraction is a part of a whole. ' +
  'When you cut a cake into four equal parts, each part is one quarter.';
const SPOKEN = LESSON.toLowerCase().replace(/[.,]/g, '');

describe('alignScript on fixtures', () => {
  it('keeps the script text and takes timing from a perfect recognition', () => {
    const out = alignScript(LESSON, heard(SPOKEN));
    expect(out.words.map((w) => w.word).join(' ')).toBe(LESSON);
    expect(out.words[0]).toMatchObject({ startMs: 0, endMs: 300 });
    expect(out.lowConfidence).toEqual([]);
    expect(out.matchRatio).toBe(1);
  });

  it('ignores extra words the speaker said that are not in the script', () => {
    const spoken = 'um ' + SPOKEN.replace('today we learn', 'so today we learn uh');
    const out = alignScript(LESSON, heard(spoken));
    expect(out.words.map((w) => w.word).join(' ')).toBe(LESSON);
    // "Welcome" is the second heard word, so it starts after the filler.
    expect(out.words[0]!.startMs).toBe(400);
    expect(out.lowConfidence).toEqual([]);
  });

  it('places script words the recogniser missed between their neighbours and flags them', () => {
    const spoken = SPOKEN.replace('equal parts ', '');
    const out = alignScript(LESSON, heard(spoken));
    const i = out.words.findIndex((w) => w.word === 'equal');
    expect(out.lowConfidence).toEqual([i, i + 1]);
    const before = out.words[i - 1]!;
    const after = out.words[i + 2]!;
    expect(out.words[i]!.startMs).toBeGreaterThanOrEqual(before.endMs);
    expect(out.words[i + 1]!.endMs).toBeLessThanOrEqual(after.startMs);
  });

  it('pairs a misheard word with the script word and flags it', () => {
    const spoken = SPOKEN.replace('quarter', 'court er');
    const out = alignScript(LESSON, heard(spoken));
    const last = out.words.length - 1;
    expect(out.words[last]!.word).toBe('quarter.');
    expect(out.lowConfidence).toContain(last);
    expect(out.lowConfidence.length).toBeLessThanOrEqual(2);
  });

  it('treats a small spelling difference as the same word and does not flag it', () => {
    const out = alignScript('Chidi has two cats.', heard('chidy has two cats'));
    expect(out.lowConfidence).toEqual([]);
  });

  it('flags words the recogniser was unsure of even when the text matches', () => {
    const words = heard(SPOKEN);
    words[3] = { ...words[3]!, confidence: 0.2 };
    const out = alignScript(LESSON, words);
    expect(out.lowConfidence).toEqual([3]);
  });

  it('handles repeated words in order instead of matching them anywhere', () => {
    const out = alignScript('no no no way', heard('no no way', 1000));
    expect(out.words.map((w) => w.word)).toEqual(['no', 'no', 'no', 'way']);
    expect(out.lowConfidence).toHaveLength(1);
    for (let i = 1; i < out.words.length; i++)
      expect(out.words[i]!.startMs).toBeGreaterThanOrEqual(out.words[i - 1]!.startMs);
  });

  it('ignores case, punctuation, curly quotes and accents when matching', () => {
    const out = alignScript(
      `It${APOS}s a caf${E_ACUTE}, isn${APOS}t it?`,
      heard("it's a cafe isn't it"),
    );
    expect(out.lowConfidence).toEqual([]);
  });

  it('places an unheard opening just before the first heard word and never before zero', () => {
    const out = alignScript('Good morning everyone. ' + LESSON, heard(SPOKEN, 500));
    expect(out.words[0]!.startMs).toBeGreaterThanOrEqual(0);
    expect(out.words[2]!.endMs).toBeLessThanOrEqual(out.words[3]!.startMs + 1);
    expect(out.lowConfidence).toEqual([0, 1, 2]);
  });

  it('places an unheard ending after the last heard word', () => {
    const out = alignScript(LESSON + ' Thank you.', heard(SPOKEN));
    const last = out.words.length;
    expect(out.words[last - 1]!.startMs).toBeGreaterThanOrEqual(out.words[last - 3]!.endMs);
    expect(out.lowConfidence).toEqual([last - 2, last - 1]);
  });

  it('keeps timing in order and each word at least as long as zero', () => {
    const spoken = SPOKEN.replace('part of a whole', 'whole');
    const out = alignScript(LESSON, heard(spoken));
    for (let i = 0; i < out.words.length; i++) {
      expect(out.words[i]!.endMs).toBeGreaterThanOrEqual(out.words[i]!.startMs);
      if (i > 0) expect(out.words[i]!.startMs).toBeGreaterThanOrEqual(out.words[i - 1]!.startMs);
    }
  });

  it('rejects a script about something else', () => {
    expect(() =>
      alignScript('Elephants walk slowly across the wide river bank today.', heard(SPOKEN)),
    ).toThrow(/does not match|lined up/);
  });

  it('copes with a ten minute lesson quickly', () => {
    const long = Array.from({ length: 1500 }, (_, i) => `word${i % 97}x`).join(' ');
    const started = Date.now();
    const out = alignScript(long, heard(long));
    expect(out.lowConfidence).toEqual([]);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('cuesFromAlignment', () => {
  it('lists the start of every cue that contains a flagged word', () => {
    const spoken = SPOKEN.replace('equal parts ', '');
    const result = alignScript(LESSON, heard(spoken));
    const { cues, lowConfidenceStarts } = cuesFromAlignment(result);
    expect(cues.length).toBeGreaterThan(1);
    expect(lowConfidenceStarts.length).toBeGreaterThan(0);
    expect(lowConfidenceStarts.length).toBeLessThan(cues.length);
    const flagged = cues.filter((c) => lowConfidenceStarts.includes(c.startMs));
    expect(flagged.some((c) => c.text.includes('equal'))).toBe(true);
  });

  it('flags nothing when everything lined up', () => {
    expect(cuesFromAlignment(alignScript(LESSON, heard(SPOKEN))).lowConfidenceStarts).toEqual([]);
  });
});
