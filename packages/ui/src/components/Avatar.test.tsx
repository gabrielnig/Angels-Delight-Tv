import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddProfileTile, Avatar, ProfileTile } from './Avatar';

describe('Avatar', () => {
  it('shows the initial letter on a pastel tile and is decorative', () => {
    const { container } = render(<Avatar name="Ada" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild?.getAttribute('data-tone')).toMatch(
      /sky|mint|lemon|peach|lavender/,
    );
  });

  it('picks the same tone for the same name', () => {
    const a = render(<Avatar name="Chidi" />).container.firstElementChild;
    const b = render(<Avatar name="Chidi" />).container.firstElementChild;
    expect(a?.getAttribute('data-tone')).toBe(b?.getAttribute('data-tone'));
  });

  it('honours an explicit tone and size', () => {
    const { container } = render(<Avatar name="Ada" tone="mint" size={160} />);
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'mint');
    expect(container.firstElementChild).toHaveAttribute('data-size', '160');
  });
});

describe('ProfileTile', () => {
  it('is a button named Switch to name', async () => {
    const onSelect = vi.fn();
    render(<ProfileTile name="Ada" onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch to Ada' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('adds Kids profile to the name and shows the badge', () => {
    render(<ProfileTile name="Tobi" kids onSelect={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Switch to Tobi, Kids profile' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Kids').length).toBeGreaterThan(0);
  });

  it('in edit mode the name says Edit and an edit badge shows', () => {
    render(<ProfileTile name="Ada" editing onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Edit Ada' })).toBeInTheDocument();
  });
});

describe('AddProfileTile', () => {
  it('is a link to the new profile form', () => {
    render(<AddProfileTile href="/profiles/new" />);
    expect(screen.getByRole('link', { name: 'Add profile' })).toHaveAttribute(
      'href',
      '/profiles/new',
    );
  });
});
