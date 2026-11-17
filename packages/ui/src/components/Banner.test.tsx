import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner';

describe('Banner', () => {
  it('uses role alert for danger so it is announced without moving focus', () => {
    render(<Banner tone="danger">That email or password is not right.</Banner>);
    expect(screen.getByRole('alert')).toHaveTextContent('That email or password is not right.');
  });

  it('uses role status for success and info', () => {
    const { rerender } = render(<Banner tone="success">Your password was changed.</Banner>);
    expect(screen.getByRole('status')).toHaveTextContent('Your password was changed.');
    rerender(<Banner tone="info">Planned work tonight.</Banner>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('pairs the message with an icon and an optional title', () => {
    const { container } = render(
      <Banner tone="warning" title="One more step">
        Complete the check.
      </Banner>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('One more step')).toBeInTheDocument();
  });

  it('renders an action slot', () => {
    render(
      <Banner tone="danger" action={<button>Retry</button>}>
        We could not save that change.
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
