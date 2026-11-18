// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TitleBlocked, TitleError, TitleNotFound, TitleSkeleton } from './TitleStates';

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

  it('says the video could not be found and points to browsing by subject', () => {
    const { container } = render(<TitleNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'We could not find that video' })).toBeInTheDocument();
    expect(container).toHaveTextContent(
      'The link may be old, or the video may have been removed. Try browsing by subject instead.',
    );
    expect(screen.getByRole('link', { name: 'Browse subjects' })).toHaveAttribute('href', '/browse');
    expect(container.querySelector('.tv-state__icon[data-tone="neutral"]')).not.toBeNull();
  });

  it('says what went wrong, that the place is safe, and shows the reference with Try again and Back to Home', async () => {
    const reset = vi.fn();
    const { container } = render(<TitleError reference="7F3K9Q2" onRetry={reset} />);
    expect(screen.getByRole('heading', { level: 1, name: 'We could not load this video' })).toBeInTheDocument();
    expect(container).toHaveTextContent(
      'Something went wrong on our side. Your place in the video is safe. Reference 7F3K9Q2.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(container.querySelector('.tv-state__icon[data-tone="danger"]')).not.toBeNull();
  });

  it('leaves the reference out when there is none', () => {
    const { container } = render(<TitleError onRetry={vi.fn()} />);
    expect(container).toHaveTextContent('Something went wrong on our side. Your place in the video is safe.');
    expect(container).not.toHaveTextContent('Reference');
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

  it('marks the lines phones leave out, as in the mobile mockup', () => {
    const { container } = render(<TitleError reference="R1" onRetry={vi.fn()} />);
    expect(container.querySelectorAll('.tv-state__wide')).toHaveLength(2);
  });
});
