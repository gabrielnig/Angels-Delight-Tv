// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExpandableText } from './ExpandableText';

describe('ExpandableText', () => {
  it('shows short text in full with no toggle', () => {
    render(<ExpandableText text="A short line." />);
    expect(screen.getByText('A short line.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('collapses long text after 3 lines and expands with Show more and Show less', async () => {
    const user = userEvent.setup();
    render(<ExpandableText text={'word '.repeat(120)} />);
    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('expandable-text')).toHaveAttribute('data-collapsed', 'true');
    expect(toggle.querySelector('svg')).not.toBeNull();
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('expandable-text')).toHaveAttribute('data-collapsed', 'false');
  });
});
