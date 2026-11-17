import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonLink, IconButton } from './Button';

describe('Button', () => {
  it('renders a native button that defaults to type button', () => {
    render(<Button>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'md');
  });

  it('calls onClick and supports keyboard activation', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Play</Button>);
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('keeps the label, sets aria-busy and ignores clicks while loading', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Sign in
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Sign in/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses the disabled attribute when disabled', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('exposes variant and size as data attributes', () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        Delete video
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete video' });
    expect(button).toHaveAttribute('data-variant', 'danger');
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button).toHaveAttribute('data-full', 'true');
  });
});

describe('ButtonLink', () => {
  it('is a link that looks like a button', () => {
    render(<ButtonLink href="/browse">Browse videos</ButtonLink>);
    const link = screen.getByRole('link', { name: 'Browse videos' });
    expect(link).toHaveAttribute('href', '/browse');
    expect(link).toHaveAttribute('data-variant', 'primary');
  });
});

describe('IconButton', () => {
  it('requires and exposes an accessible name', () => {
    render(<IconButton label="Close" icon="close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('reports toggle state with aria-pressed', () => {
    render(<IconButton label="Add to My List" icon="plus" pressed={true} />);
    expect(screen.getByRole('button', { name: 'Add to My List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hides the icon from assistive technology', () => {
    const { container } = render(<IconButton label="Search" icon="search" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
