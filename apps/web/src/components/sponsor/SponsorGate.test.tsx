// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectedSponsor } from '@ad/sponsors';
import { SponsorGate } from './SponsorGate';

vi.mock('../../lib/analytics/browser', () => ({ getAnalyticsClient: () => ({ track: vi.fn() }) }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const sponsor: SelectedSponsor = {
  sponsorId: 's',
  sponsorName: 'Acme',
  creativeId: '0190a000-0000-7000-8000-000000000002',
  slot: 'player_before',
  headline: 'Learn with Acme',
  body: null,
  ctaLabel: 'Visit',
  href: '/s/0190a000-0000-7000-8000-000000000002',
  imageUrl: null,
  wideImageUrl: null,
  altText: null,
  textOnly: true,
  label: 'sponsored',
  newTab: true,
};

describe('SponsorGate', () => {
  it('shows the video straight away when there is no sponsor', () => {
    render(
      <SponsorGate sponsor={null} seconds={5}>
        <p>player</p>
      </SponsorGate>,
    );
    expect(screen.getByText('player')).toBeTruthy();
  });
  it('holds the player back and shows a Skip button at once', () => {
    render(
      <SponsorGate sponsor={sponsor} seconds={5}>
        <p>player</p>
      </SponsorGate>,
    );
    expect(screen.queryByText('player')).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(screen.getByText('Learn with Acme')).toBeTruthy();
  });
  it('lets the video start when Skip is pressed', () => {
    render(
      <SponsorGate sponsor={sponsor} seconds={5}>
        <p>player</p>
      </SponsorGate>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByText('player')).toBeTruthy();
  });
  it('lets the video start by itself when the time is up', () => {
    render(
      <SponsorGate sponsor={sponsor} seconds={3}>
        <p>player</p>
      </SponsorGate>,
    );
    act(() => void vi.advanceTimersByTime(3100));
    expect(screen.getByText('player')).toBeTruthy();
  });
  it('counts down in words for screen readers without announcing every second', () => {
    render(
      <SponsorGate sponsor={sponsor} seconds={5}>
        <p>player</p>
      </SponsorGate>,
    );
    expect(screen.getByText('Your video starts in 5 seconds')).toBeTruthy();
    expect(document.querySelector('[aria-live]')).toBeNull();
  });
});
