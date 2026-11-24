// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { writeGuestProgress } from '../../lib/guest/progress-store';
import { GuestEpisodeProgress } from './GuestEpisodeProgress';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ep = (n: number, id: string) => ({
  number: n,
  title: `T${n}`,
  blurb: 'b',
  durationSeconds: 600,
  href: `/watch/${id}`,
  watched: false,
});

describe('GuestEpisodeProgress', () => {
  beforeEach(() => localStorage.clear());

  it('shows watched and in progress episodes from this device, with Up next on the first unfinished', async () => {
    writeGuestProgress(localStorage, A, { p: 595, d: 600, f: true });
    render(
      <GuestEpisodeProgress
        seasons={[{ number: 1, episodes: [ep(1, A), ep(2, B)] }]}
        initialSeason={1}
      />,
    );
    expect(await screen.findByText(/Up next/)).toBeInTheDocument();
    expect(screen.getByText(/Watched/)).toBeInTheDocument();
  });
});
