// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDataSaver } from './useDataSaver';

beforeEach(() => localStorage.clear());

describe('useDataSaver', () => {
  it('starts off on a normal connection', () => {
    const { result } = renderHook(() => useDataSaver('p1'));
    expect(result.current.on).toBe(false);
    expect(result.current.announce).toBe(false);
  });

  it('turns on from Save-Data once and announces, then keeps it quiet', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    const first = renderHook(() => useDataSaver('p2'));
    expect(first.result.current.on).toBe(true);
    expect(first.result.current.announce).toBe(true);
    act(() => first.result.current.dismissAnnouncement());
    expect(first.result.current.announce).toBe(false);
    first.unmount();
    const second = renderHook(() => useDataSaver('p2'));
    expect(second.result.current.announce).toBe(false);
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  });

  it('persists a manual toggle per profile and calls the sync hook', () => {
    const synced: boolean[] = [];
    const { result } = renderHook(() => useDataSaver('p3', { onChange: (on) => synced.push(on) }));
    act(() => result.current.setOn(true));
    expect(result.current.on).toBe(true);
    expect(localStorage.getItem('ad.datasaver.p3')).toBe('on');
    expect(synced).toEqual([true]);
    const other = renderHook(() => useDataSaver('p4'));
    expect(other.result.current.on).toBe(false);
  });

  it('is on when the profile turned Data saver on, on any device (M03-S09)', () => {
    const { result } = renderHook(() => useDataSaver('p5', { profileSetting: true }));
    expect(result.current.on).toBe(true);
    expect(result.current.announce).toBe(false);
  });
});
