// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginHistoryCard } from './LoginHistoryCard';

const rows = [
  {
    id: 'e1',
    when: '1 hour ago',
    outcome: 'success' as const,
    place: 'Nigeria',
    deviceLabel: 'Chrome on Android',
    device: 'phone' as const,
    newDevice: true,
  },
  {
    id: 'e2',
    when: '2 days ago',
    outcome: 'failed' as const,
    place: 'Location unknown',
    deviceLabel: 'Edge on Windows',
    device: 'computer' as const,
    newDevice: false,
  },
  {
    id: 'e3',
    when: '3 days ago',
    outcome: 'mfa_failed' as const,
    place: 'Ghana',
    deviceLabel: 'Safari on iPhone',
    device: 'phone' as const,
    newDevice: false,
  },
];

describe('LoginHistoryCard (S177)', () => {
  it('lists each attempt with country, device and outcome in words', () => {
    render(<LoginHistoryCard entries={rows} />);
    expect(screen.getByRole('heading', { name: 'Recent sign ins' })).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Wrong password')).toBeInTheDocument();
    expect(screen.getByText('Wrong code')).toBeInTheDocument();
    expect(screen.getByText('Chrome on Android, Nigeria, 1 hour ago')).toBeInTheDocument();
  });

  it('marks a new device', () => {
    render(<LoginHistoryCard entries={rows} />);
    expect(screen.getAllByText('New device')).toHaveLength(1);
  });

  it('says so when there is nothing yet', () => {
    render(<LoginHistoryCard entries={[]} />);
    expect(screen.getByText('No sign ins recorded yet.')).toBeInTheDocument();
  });

  it('states that only the country is kept', () => {
    render(<LoginHistoryCard entries={rows} />);
    expect(screen.getByText(/country only, never an address/i)).toBeInTheDocument();
  });
});
