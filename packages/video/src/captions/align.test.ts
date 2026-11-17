import { describe, expect, it } from 'vitest';
import { PipelineError } from '../failure';
import { alignScript, cleanScript } from './align';

describe('cleanScript', () => {
  it('removes speaker names, stage directions and extra blank lines (M15-S02 edge)', () => {
    const script =
      'NARRATOR: Welcome to the lesson.\n[music fades in]\n\n\n(softly) Today we learn fractions.\nMR ADE: Let us begin!';
    expect(cleanScript(script)).toBe(
      'Welcome to the lesson.\nToday we learn fractions.\nLet us begin!',
    );
  });
  it('keeps colons inside sentences', () => {
    expect(cleanScript('There are two options: stay or go.')).toBe(
      'There are two options: stay or go.',
    );
  });
});

const words = (list: string[]) =>
  list.map((word, i) => ({ word, startMs: i * 500, endMs: i * 500 + 400, confidence: 0.9 }));

describe('alignScript', () => {
  it('uses the script wording with the recognised timing', () => {
    const recognised = words([
      'welcome',
      'to',
      'the',
      'lesson',
      'today',
      'we',
      'learn',
      'fractions',
    ]);
    const result = alignScript('Welcome to the lesson. Today we learn fractions.', recognised);
    expect(result.words.map((w) => w.word)).toEqual([
      'Welcome',
      'to',
      'the',
      'lesson.',
      'Today',
      'we',
      'learn',
      'fractions.',
    ]);
    expect(result.words[0]).toMatchObject({ startMs: 0 });
    expect(result.words.at(-1)?.endMs).toBe(3900);
    expect(result.lowConfidence).toEqual([]);
  });

  it('spreads script words across the speech span when counts differ a little, and flags them', () => {
    const recognised = words([
      'welcome',
      'to',
      'the',
      'lesson',
      'today',
      'we',
      'learn',
      'fractions',
    ]);
    const result = alignScript(
      'Welcome to the lesson. Today we will learn about fractions.',
      recognised,
    );
    expect(result.words).toHaveLength(10);
    expect(result.words[0]!.startMs).toBe(0);
    expect(result.words.at(-1)!.endMs).toBeLessThanOrEqual(3900);
    for (let i = 1; i < result.words.length; i++)
      expect(result.words[i]!.startMs).toBeGreaterThanOrEqual(result.words[i - 1]!.startMs);
    expect(result.lowConfidence.length).toBeGreaterThan(0);
  });

  it('refuses a script that does not match the audio and says so in plain words', () => {
    const recognised = words([
      'welcome',
      'to',
      'the',
      'lesson',
      'today',
      'we',
      'learn',
      'fractions',
    ]);
    const error = (() => {
      try {
        alignScript(
          'Completely unrelated text about elephants and rivers in distant lands.',
          recognised,
        );
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toMatchObject({ code: 'script_mismatch', permanent: true });
    expect((error as PipelineError).plain).toBe('The script does not match the audio.');
  });

  it('refuses an empty script or empty audio', () => {
    expect(() => alignScript('', words(['a']))).toThrow(PipelineError);
    expect(() => alignScript('hello there', [])).toThrow(PipelineError);
  });
});
