import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveMarker } from '../markers';
import { SkipButton } from './SkipButton';

const intro: ActiveMarker = { kind: 'intro', skipTo: 48, nextLesson: false };

function renderButton(props: Partial<React.ComponentProps<typeof SkipButton>> = {}) {
  const onSkip = vi.fn();
  const view = render(
    <SkipButton marker={intro} showKeyHint activity={0} onSkip={onSkip} {...props} />,
  );
  return { onSkip, ...view };
}

describe('SkipButton', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows Skip intro inside the intro window and nothing outside', () => {
    const { rerender } = renderButton();
    expect(screen.getByRole('button', { name: /Skip intro/ })).toBeTruthy();
    rerender(<SkipButton marker={null} showKeyHint activity={0} onSkip={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the S key hint on desktop only and sets aria-keyshortcuts there', () => {
    const { rerender } = renderButton({ showKeyHint: true });
    expect(screen.getByRole('button').textContent).toContain('S');
    expect(screen.getByRole('button').getAttribute('aria-keyshortcuts')).toBe('S');
    rerender(<SkipButton marker={intro} showKeyHint={false} activity={0} onSkip={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('Skip intro');
    expect(screen.getByRole('button').getAttribute('aria-keyshortcuts')).toBeNull();
  });

  it('shows Skip recap, Next lesson on credits with a next title and Skip credits without one', () => {
    const { rerender } = renderButton({ marker: { kind: 'recap', skipTo: 90, nextLesson: false } });
    expect(screen.getByRole('button', { name: /Skip recap/ })).toBeTruthy();
    rerender(
      <SkipButton
        marker={{ kind: 'credits', skipTo: 300, nextLesson: true }}
        showKeyHint
        activity={0}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Next lesson/ })).toBeTruthy();
    rerender(
      <SkipButton
        marker={{ kind: 'credits', skipTo: 300, nextLesson: false }}
        showKeyHint
        activity={0}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Skip credits/ })).toBeTruthy();
  });

  it('click calls onSkip', () => {
    const { onSkip } = renderButton();
    fireEvent.click(screen.getByRole('button'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('hides after 8 seconds without hover or focus and returns on activity', () => {
    const { rerender } = renderButton();
    const button = () => screen.getByRole('button');
    expect(button().getAttribute('data-visible')).toBe('true');
    act(() => vi.advanceTimersByTime(7_900));
    expect(button().getAttribute('data-visible')).toBe('true');
    act(() => vi.advanceTimersByTime(200));
    expect(button().getAttribute('data-visible')).toBeNull();
    rerender(<SkipButton marker={intro} showKeyHint activity={1} onSkip={() => {}} />);
    expect(button().getAttribute('data-visible')).toBe('true');
    act(() => vi.advanceTimersByTime(8_100));
    expect(button().getAttribute('data-visible')).toBeNull();
  });

  it('stays visible while it has focus or the pointer is over it', () => {
    renderButton();
    const button = screen.getByRole('button');
    fireEvent.focus(button);
    act(() => vi.advanceTimersByTime(20_000));
    expect(button.getAttribute('data-visible')).toBe('true');
    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(8_100));
    expect(button.getAttribute('data-visible')).toBeNull();
    fireEvent.pointerEnter(button);
    expect(button.getAttribute('data-visible')).toBe('true');
    act(() => vi.advanceTimersByTime(20_000));
    expect(button.getAttribute('data-visible')).toBe('true');
  });

  it('starts a fresh timer when the window kind changes', () => {
    const { rerender } = renderButton();
    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByRole('button').getAttribute('data-visible')).toBeNull();
    rerender(
      <SkipButton
        marker={{ kind: 'recap', skipTo: 90, nextLesson: false }}
        showKeyHint
        activity={0}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByRole('button').getAttribute('data-visible')).toBe('true');
  });
});
