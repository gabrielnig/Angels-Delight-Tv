import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutsDialog } from './ShortcutsDialog';

describe('ShortcutsDialog', () => {
  it('lists S and T', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Skip intro, recap or credits')).toBeTruthy();
    expect(screen.getByText('Theatre mode')).toBeTruthy();
  });

  it('traps focus and closes on Escape', () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog onClose={onClose} />);
    const close = screen.getAllByRole('button')[0]!;
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
