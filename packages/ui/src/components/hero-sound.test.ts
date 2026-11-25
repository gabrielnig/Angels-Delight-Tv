import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { heroSound, resetHeroSound, useHeroSound } from './hero-sound';

beforeEach(resetHeroSound);

describe('hero sound choice (in memory, this page visit only)', () => {
  it('starts off, every visit', () => {
    expect(heroSound.get()).toBe(false);
  });

  it('keeps the choice across components and tells every listener once per change', () => {
    const seen: boolean[] = [];
    const stop = heroSound.subscribe(() => seen.push(heroSound.get()));
    heroSound.set(true);
    heroSound.set(true);
    heroSound.set(false);
    stop();
    heroSound.set(true);
    expect(seen).toEqual([true, false]);
  });

  it('is read by the hook and changed through it', () => {
    const { result } = renderHook(() => useHeroSound());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    const second = renderHook(() => useHeroSound());
    expect(second.result.current[0]).toBe(true);
  });

  it('writes nothing to the browser storage', () => {
    heroSound.set(true);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});
