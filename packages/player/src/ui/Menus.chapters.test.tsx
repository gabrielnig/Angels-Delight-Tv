import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChapterRows, MenuShell } from './Menus';

const chapters = [
  { start: 0, title: 'Welcome' },
  { start: 134, title: 'Mixing colours' },
  { start: 3_723, title: 'Review' },
];

describe('ChapterRows', () => {
  it('lists chapters with times and marks the current one', () => {
    render(<ChapterRows chapters={chapters} current={1} onSelect={() => {}} />);
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent)).toEqual([
      '0:00Welcome',
      '2:14Mixing colours',
      '1:02:03Review',
    ]);
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
  });

  it('selecting a chapter reports its start', () => {
    const onSelect = vi.fn();
    render(<ChapterRows chapters={chapters} current={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Mixing colours/ }));
    expect(onSelect).toHaveBeenCalledWith(134);
  });

  it('moves between chapters with the arrow keys and Escape closes the menu', () => {
    const onClose = vi.fn();
    render(
      <MenuShell id="m" label="Chapters" onClose={onClose}>
        <ChapterRows chapters={chapters} current={1} onSelect={() => {}} />
      </MenuShell>,
    );
    const rows = screen.getAllByRole('menuitemradio');
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
