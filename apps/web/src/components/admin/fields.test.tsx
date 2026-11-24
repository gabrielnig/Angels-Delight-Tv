// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './fields';

describe('Checkbox mixed state', () => {
  it('shows the mixed state for a partly selected group', () => {
    render(<Checkbox label="Select all" checked={false} mixed onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.getAttribute('aria-checked')).toBe('mixed');
  });

  it('is not mixed by default', () => {
    render(<Checkbox label="One" checked={false} onChange={() => {}} />);
    const box = screen.getByRole('checkbox', { name: 'One' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(false);
    expect(box.getAttribute('aria-checked')).toBeNull();
  });
});
