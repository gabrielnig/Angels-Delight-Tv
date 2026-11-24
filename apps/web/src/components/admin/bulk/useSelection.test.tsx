// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSelection } from './useSelection';

afterEach(cleanup);

describe('useSelection', () => {
  it('toggle and togglePage change the count', () => {
    const { result } = renderHook(() => useSelection(['a', 'b', 'c']));
    act(() => result.current.toggle('a'));
    expect(result.current.count).toBe(1);
    expect(result.current.isSelected('a')).toBe(true);
    act(() => result.current.togglePage());
    expect(result.current.count).toBe(3);
    expect(result.current.allOnPage).toBe(true);
    act(() => result.current.togglePage());
    expect(result.current.count).toBe(0);
  });

  it('ids that leave the data are pruned', () => {
    const { result, rerender } = renderHook(({ rows }) => useSelection(rows), {
      initialProps: { rows: ['a', 'b', 'c'] },
    });
    act(() => result.current.togglePage());
    rerender({ rows: ['a', 'c'] });
    expect(result.current.count).toBe(2);
    expect([...result.current.selected].sort()).toEqual(['a', 'c']);
  });

  it('selection survives a refresh with the same rows', () => {
    const { result, rerender } = renderHook(({ rows }) => useSelection(rows), {
      initialProps: { rows: ['a', 'b'] },
    });
    act(() => result.current.toggle('b'));
    rerender({ rows: ['a', 'b'] });
    rerender({ rows: ['b', 'a'] });
    expect(result.current.isSelected('b')).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it('all matching scope reports the capped count', () => {
    const many = Array.from({ length: 620 }, (_, i) => `m-${i}`);
    const { result } = renderHook(() => useSelection(['a', 'b']));
    act(() => result.current.selectMatching(many));
    expect(result.current.scope).toBe('matching');
    expect(result.current.count).toBe(500);
    expect(result.current.capped).toEqual({ total: 620, used: 500 });
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.scope).toBe('page');
  });

  it('a manual toggle leaves the matching scope', () => {
    const { result } = renderHook(() => useSelection(['a', 'b']));
    act(() => result.current.selectMatching(['x', 'y', 'z']));
    act(() => result.current.toggle('x'));
    expect(result.current.scope).toBe('page');
  });

  it('locked ids are never selected by togglePage', () => {
    const { result } = renderHook(() => useSelection(['a', 'b', 'c'], { isLocked: (id) => id === 'b' }));
    act(() => result.current.togglePage());
    expect([...result.current.selected].sort()).toEqual(['a', 'c']);
    expect(result.current.allOnPage).toBe(true);
  });
});
