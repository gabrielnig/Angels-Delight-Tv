import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'episodes', label: 'Episodes', panel: <p>Episode list</p> },
  { id: 'more', label: 'More like this', panel: <p>Related</p> },
  { id: 'details', label: 'Details', panel: <p>Details text</p> },
];

describe('Tabs', () => {
  it('uses tablist, tab and tabpanel roles with the first tab selected', () => {
    render(<Tabs label="Title sections" tabs={tabs} />);
    expect(screen.getByRole('tablist', { name: 'Title sections' })).toBeInTheDocument();
    const first = screen.getByRole('tab', { name: 'Episodes' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Episode list');
    expect(first.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
  });

  it('uses a roving tabindex', () => {
    render(<Tabs label="Sections" tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Episodes' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves with arrow keys, wraps, and jumps with Home and End', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Sections" tabs={tabs} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'More like this' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Related');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Episodes' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Episodes' })).toHaveFocus();
  });

  it('skips disabled tabs', async () => {
    const user = userEvent.setup();
    render(<Tabs label="Sections" tabs={[tabs[0]!, { ...tabs[1]!, disabled: true }, tabs[2]!]} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
  });

  it('can be controlled and reports changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs label="Sections" tabs={tabs} value="details" onChange={onChange} />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details text');
    await user.click(screen.getByRole('tab', { name: 'Episodes' }));
    expect(onChange).toHaveBeenCalledWith('episodes');
  });
});
