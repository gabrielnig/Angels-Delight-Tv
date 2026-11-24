// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkBar, type BulkBarAction } from './BulkBar';

afterEach(cleanup);

const base = { onClear: () => {}, actions: [] as BulkBarAction[] };

describe('BulkBar', () => {
  it('announces the selected count politely', () => {
    render(<BulkBar {...base} count={12} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('12 selected');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('shows Select all N that match only when the page is fully selected and more rows match', () => {
    const onSelectMatching = vi.fn();
    const { rerender } = render(
      <BulkBar {...base} count={25} pageFullySelected matchTotal={48} onSelectMatching={onSelectMatching} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select all 48 that match' }));
    expect(onSelectMatching).toHaveBeenCalled();
    rerender(<BulkBar {...base} count={10} matchTotal={48} onSelectMatching={onSelectMatching} />);
    expect(screen.queryByText(/Select all 48/)).toBeNull();
    rerender(<BulkBar {...base} count={25} pageFullySelected matchTotal={25} onSelectMatching={onSelectMatching} />);
    expect(screen.queryByText(/Select all/)).toBeNull();
    rerender(<BulkBar {...base} count={25} pageFullySelected matchTotal={48} />);
    expect(screen.queryByText(/Select all/)).toBeNull();
  });

  it('the select all link is a 44px class', () => {
    render(<BulkBar {...base} count={25} pageFullySelected matchTotal={48} onSelectMatching={() => {}} />);
    expect(screen.getByRole('button', { name: 'Select all 48 that match' })).toHaveClass('adm-bulk__all');
  });

  it('Clear empties the selection and returns focus to the table', () => {
    document.body.insertAdjacentHTML('beforeend', '<table id="t" tabindex="-1"></table>');
    const onClear = vi.fn();
    render(<BulkBar count={3} onClear={onClear} actions={[]} returnFocusTo={() => document.getElementById('t')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById('t'));
  });

  it('narrow layout moves secondary actions into a More menu', () => {
    const actions: BulkBarAction[] = [
      { id: 'pub', label: 'Publish', onClick: () => {}, variant: 'primary' },
      { id: 'caps', label: 'Captions for viewers', onClick: () => {}, secondary: true },
    ];
    render(<BulkBar {...base} count={2} actions={actions} />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Captions for viewers' })).toBeInTheDocument();
  });

  it('a More menu item runs the action and closes the menu', () => {
    const onClick = vi.fn();
    render(<BulkBar {...base} count={2} actions={[{ id: 'x', label: 'Extra', onClick, secondary: true }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Extra' }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('buttons carry a reason when disabled and stay focusable', () => {
    const onClick = vi.fn();
    render(
      <BulkBar
        {...base}
        count={2}
        actions={[{ id: 'del', label: 'Delete', onClick, disabledReason: 'Only an Admin can delete.' }]}
      />,
    );
    const button = screen.getByRole('button', { name: /Delete/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Only an Admin can delete.');
    expect(button.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a short note beside the count', () => {
    render(<BulkBar {...base} count={500} note="The first 500 are used when more match." />);
    expect(screen.getByText('The first 500 are used when more match.')).toBeInTheDocument();
  });
});
