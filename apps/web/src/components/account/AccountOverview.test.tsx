// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../../app/actions', () => ({ signOutAction: vi.fn() }));

import { AccountOverview } from './AccountOverview';

const overview = {
  displayName: 'Ada Obi',
  email: 'ada@example.com',
  memberSince: '2026-01-05T00:00:00.000Z',
  watchedThisMonth: 7,
  minutesLearning: 120,
  myListCount: 3,
  devices: 2,
};

describe('AccountOverview', () => {
  it('shows a profile card with the name and masked email', () => {
    render(<AccountOverview overview={overview} />);
    const card = screen.getByRole('region', { name: 'Your account' });
    expect(within(card).getByText('Ada Obi')).toBeInTheDocument();
    expect(within(card).queryByText('ada@example.com')).toBeNull();
  });

  it('shows the four stats as labelled values', () => {
    render(<AccountOverview overview={overview} />);
    const stats = screen.getByRole('region', { name: 'Your learning' });
    const expected: [string, string][] = [
      ['Watched this month', '7'],
      ['Minutes learning', '120'],
      ['Saved in My List', '3'],
      ['Signed in devices', '2'],
    ];
    for (const [label, value] of expected) {
      expect(within(stats).getByText(label).parentElement).toHaveTextContent(value);
    }
  });

  it('offers link rows and a sign out card', () => {
    render(<AccountOverview overview={overview} />);
    expect(screen.getByRole('link', { name: /Security/ })).toHaveAttribute('href', '/account/security');
    expect(screen.getByRole('link', { name: /Your data/ })).toHaveAttribute('href', '/account/data');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
