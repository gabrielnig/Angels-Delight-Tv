// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../lib/data';
import { ProfilePicker } from './ProfilePicker';

const profile = (over: Partial<Profile>): Profile => ({
  id: 'p1',
  name: 'Adaeze',
  kids: false,
  owner: true,
  language: 'en',
  autoplayNext: true,
  ...over,
});

const four = [
  profile({ id: 'p1', name: 'Adaeze', lastUsedHere: true }),
  profile({ id: 'p2', name: 'Emeka', owner: false }),
  profile({ id: 'p3', name: 'Amina', kids: true, owner: false }),
  profile({ id: 'p4', name: 'Tobi', kids: true, owner: false }),
];

describe('ProfilePicker', () => {
  it('asks who is watching and shows a tile button per profile', () => {
    render(<ProfilePicker profiles={four} max={5} onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Who is watching?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Adaeze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Amina, Kids profile' })).toBeInTheDocument();
  });

  it('shows Add profile and Manage profiles', () => {
    render(<ProfilePicker profiles={four} max={5} onSelect={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Add profile' })).toHaveAttribute('href', '/profiles/new');
    expect(screen.getByRole('link', { name: 'Manage profiles' })).toHaveAttribute('href', '/profiles/manage');
  });

  it('selects a profile with click and with the keyboard', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ProfilePicker profiles={four} max={5} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Switch to Emeka' }));
    expect(onSelect).toHaveBeenCalledWith('p2');
    screen.getByRole('button', { name: 'Switch to Adaeze' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('tabs through tiles in order', async () => {
    const user = userEvent.setup();
    render(<ProfilePicker profiles={four} max={5} onSelect={vi.fn()} />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Switch to Adaeze' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Switch to Emeka' })).toHaveFocus();
  });

  it('hides Add profile and says why when the limit is reached', () => {
    const five = [...four, profile({ id: 'p5', name: 'Ngozi', owner: false })];
    render(<ProfilePicker profiles={five} max={5} onSelect={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Add profile' })).toBeNull();
    expect(screen.getByText('You have 5 profiles, the most we allow. Delete one to add another.')).toBeInTheDocument();
  });

  it('invites the first profile when there are none', () => {
    render(<ProfilePicker profiles={[]} max={5} onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Create your first profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create profile' })).toHaveAttribute('href', '/profiles/new');
  });

  it('shows a skeleton of circles while loading', () => {
    vi.useFakeTimers();
    render(<ProfilePicker profiles={[]} max={5} loading onSelect={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(screen.getByText('Loading profiles')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows an error with retry and sign out', async () => {
    const onRetry = vi.fn();
    render(<ProfilePicker profiles={[]} max={5} error onRetry={onRetry} onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load profiles. Try again.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('auto selects when there is exactly one profile and skip is on', () => {
    const onSelect = vi.fn();
    render(<ProfilePicker profiles={[profile({})]} max={5} autoSkip onSelect={onSelect} />);
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('does not auto select when the picker was opened on purpose', () => {
    const onSelect = vi.fn();
    render(<ProfilePicker profiles={[profile({})]} max={5} onSelect={onSelect} />);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('in manage mode tiles edit instead of switch and Done returns', () => {
    render(<ProfilePicker profiles={four} max={5} mode="manage" onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Manage profiles' })).toBeInTheDocument();
    const tiles = screen.getByRole('list', { name: 'Profiles' });
    expect(within(tiles).getByRole('link', { name: 'Edit Emeka' })).toHaveAttribute('href', '/profiles/p2/edit');
    expect(screen.getByRole('link', { name: 'Done' })).toHaveAttribute('href', '/profiles');
  });
});
