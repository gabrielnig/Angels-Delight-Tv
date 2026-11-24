// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StillWatching } from './StillWatching';

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof StillWatching>[0]> = {}) {
  const onKeep = vi.fn();
  const onStop = vi.fn();
  render(
    <StillWatching
      title="Why the Sky Is Blue"
      stopHref="/series/everyday-science"
      onKeep={onKeep}
      onStop={onStop}
      {...props}
    />,
  );
  return { onKeep, onStop };
}

describe('StillWatching (L4-08)', () => {
  it('asks the question, names the next title and focuses Keep watching', () => {
    setup();
    const dialog = screen.getByRole('alertdialog', { name: 'Still watching?' });
    expect(dialog.textContent).toContain('Why the Sky Is Blue');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep watching' }));
  });

  it('traps focus between its two actions', () => {
    setup();
    const keep = screen.getByRole('button', { name: 'Keep watching' });
    const stop = screen.getByRole('link', { name: 'Stop' });
    stop.focus();
    fireEvent.keyDown(stop, { key: 'Tab' });
    expect(document.activeElement).toBe(keep);
    fireEvent.keyDown(keep, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(stop);
  });

  it('Keep watching calls the handler', () => {
    const { onKeep } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Keep watching' }));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('Stop returns to the title page', () => {
    const { onStop } = setup();
    expect(screen.getByRole('link', { name: 'Stop' }).getAttribute('href')).toBe(
      '/series/everyday-science',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('is a button that stops in place when there is no title page', () => {
    const { onStop } = setup({ stopHref: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('Escape stops', () => {
    const { onStop } = setup();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
