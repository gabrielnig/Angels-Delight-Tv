// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitleBlocked, TitleSkeleton } from './TitleStates';

describe('title page states (S18)', () => {
  it('says the video is not on this Kids profile and offers Back to Home and Switch profile', () => {
    const { container } = render(<TitleBlocked />);
    expect(screen.getByRole('heading', { level: 1, name: 'Not available on this profile' })).toBeInTheDocument();
    expect(
      screen.getByText('This video is not part of the Kids library. Switch to an adult profile to watch it.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Switch profile' })).toHaveAttribute('href', '/profiles?switch=1');
    expect(container.querySelector('.tv-state__icon[data-tone="info"]')).not.toBeNull();
  });

  it('shows a skeleton with the poster and text geometry, marked busy', () => {
    const { container } = render(<TitleSkeleton delayMs={0} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('.tv-layout > .tv-sk--poster')).not.toBeNull();
    expect(container.querySelectorAll('.tv-sk').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows nothing for the first 300ms so quick loads never flash', () => {
    const { container } = render(<TitleSkeleton />);
    expect(container.querySelector('.tv-sk')).toBeNull();
  });
});
