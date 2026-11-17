import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes progressbar semantics with values', () => {
    render(<ProgressBar value={60} label="Watched" />);
    const bar = screen.getByRole('progressbar', { name: 'Watched' });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '60 percent');
  });

  it('clamps out of range values', () => {
    render(<ProgressBar value={140} label="Done" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows a visible number on request', () => {
    render(<ProgressBar value={62} label="Upload" showValue />);
    expect(screen.getByText('62%')).toBeInTheDocument();
  });
});
