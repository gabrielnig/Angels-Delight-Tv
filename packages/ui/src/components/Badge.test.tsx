import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('shows text so meaning never depends on colour', () => {
    render(<Badge variant="success">Published</Badge>);
    expect(screen.getByText('Published').closest('.ad-badge')).toHaveAttribute(
      'data-variant',
      'success',
    );
  });

  it('adds an icon for status variants and hides it from assistive technology', () => {
    const { container } = render(<Badge variant="danger">Failed</Badge>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a kids badge with a shield', () => {
    const { container } = render(<Badge variant="kids">Kids</Badge>);
    expect(screen.getByText('Kids')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('offers a visually hidden full text for a duration badge', () => {
    render(
      <Badge variant="duration" srText="4 minutes 12 seconds">
        4:12
      </Badge>,
    );
    expect(screen.getByText('4 minutes 12 seconds')).toHaveClass('ad-sr-only');
  });
});
