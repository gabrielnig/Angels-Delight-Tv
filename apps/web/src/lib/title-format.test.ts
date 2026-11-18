import { describe, expect, it } from 'vitest';
import {
  exactDuration,
  exactLeft,
  seriesLine,
  titlePrimaryText,
  watchedLabel,
} from './title-format';

describe('title page wording (S18)', () => {
  it('says the exact length in minutes and seconds', () => {
    expect(exactDuration(352)).toBe('5 min 52 sec');
    expect(exactDuration(300)).toBe('5 min');
    expect(exactDuration(45)).toBe('45 sec');
    expect(exactDuration(3725)).toBe('1 hr 2 min 5 sec');
    expect(exactDuration(3600)).toBe('1 hr');
  });

  it('says the exact time left and never a negative', () => {
    expect(exactLeft(352, 134)).toBe('3 min 38 sec left');
    expect(exactLeft(100, 140)).toBe('0 sec left');
  });

  it('says how much was watched as clock times', () => {
    expect(watchedLabel(134, 352)).toBe('2:14 of 5:52 watched');
  });

  it('writes the series line long for desktop and short for phones', () => {
    const series = { slug: 's', title: 'Everyday Science', season: 1, episode: 3 };
    expect(seriesLine(series).long).toBe('Everyday Science, Season 1, Episode 3');
    expect(seriesLine(series).short).toBe('Everyday Science, S1 E3');
  });

  it('words the main button from the play state', () => {
    expect(titlePrimaryText('play', 0, 352)).toBe('Play');
    expect(titlePrimaryText('watch_again', 0, 352)).toBe('Watch again');
    expect(titlePrimaryText('resume', 134, 352)).toBe('Resume, 3 min 38 sec left');
  });
});
