// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StickyPlay } from './StickyPlay';
import { writeGuestProgress } from '../../lib/guest/progress-store';

const A = '00000000-0000-4000-8000-00000000000a';
const V1 = '00000000-0000-4000-8000-0000000000c1';

afterEach(() => window.localStorage.clear());

describe('StickyPlay (M51-S06)', () => {
  it('shows the server button for a signed in viewer', () => {
    render(<StickyPlay primary={{ text: 'Resume, 3 min left', href: '/watch/a' }} />);
    expect(screen.getByRole('link', { name: 'Resume, 3 min left' })).toHaveAttribute(
      'href',
      '/watch/a',
    );
  });

  it('follows device progress for a guest on a video', async () => {
    writeGuestProgress(window.localStorage, V1, { p: 125, d: 600, f: false });
    render(
      <StickyPlay
        primary={{ text: 'Play', href: '/watch/v1' }}
        guest={{ videoId: V1, durationSeconds: 600 }}
      />,
    );
    expect(await screen.findByRole('link', { name: 'Resume from 2:05' })).toBeInTheDocument();
  });

  it('follows device progress for a guest on a series', async () => {
    writeGuestProgress(window.localStorage, A, { p: 40, d: 600, f: false });
    render(
      <StickyPlay
        primary={{ text: 'Play S1 E1', href: '/watch/a' }}
        guest={{
          series: {
            episodes: [{ videoId: A, href: '/watch/a', group: 1, number: 1, durationSeconds: 600 }],
          },
        }}
      />,
    );
    expect(await screen.findByRole('link', { name: 'Resume S1 E1' })).toBeInTheDocument();
  });

  it('is the phone only bar', () => {
    const { container } = render(<StickyPlay primary={{ text: 'Play', href: '/watch/a' }} />);
    expect(container.querySelector('.tv-sticky')).not.toBeNull();
  });
});
