import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CaptionTrack } from '../types';
import { CaptionRows } from './Menus';
import { PlayerTProvider } from '../t';

const track = (language: string, label: string): CaptionTrack => ({
  id: language,
  language,
  label,
  src: `/c/${language}.vtt`,
  status: 'approved',
});
const tracks = [track('en', 'English'), track('yo', 'Yorùbá'), track('ha', 'Hausa')];

describe('CaptionRows (M46-S14)', () => {
  it('lists Off first, then each language by its own name', () => {
    render(<CaptionRows tracks={tracks} active={null} onSelect={() => {}} />);
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent?.trim())).toEqual(['Off', 'English', 'Yorùbá', 'Hausa']);
    expect(rows[0]!.getAttribute('aria-checked')).toBe('true');
  });

  it('each language row carries its own lang attribute and Off does not', () => {
    render(<CaptionRows tracks={tracks} active="yo" onSelect={() => {}} />);
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.querySelector('[lang]')?.getAttribute('lang') ?? r.getAttribute('lang'))).toEqual([
      null,
      'en',
      'yo',
      'ha',
    ]);
    expect(rows[2]!.getAttribute('aria-checked')).toBe('true');
  });

  it('only the listed tracks appear', () => {
    render(<CaptionRows tracks={[tracks[0]!]} active={null} onSelect={() => {}} />);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(screen.queryByText('Hausa')).toBeNull();
  });

  it('selecting reports the track id, and Off reports null', () => {
    const onSelect = vi.fn();
    render(<CaptionRows tracks={tracks} active={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Yorùbá' }));
    expect(onSelect).toHaveBeenLastCalledWith('yo');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Off' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('Off comes from the t function the host gave', () => {
    render(
      <PlayerTProvider t={((k: string) => (k === 'player.captions.off' ? 'Pa' : k)) as never}>
        <CaptionRows tracks={tracks} active={null} onSelect={() => {}} />
      </PlayerTProvider>,
    );
    expect(screen.getByRole('menuitemradio', { name: 'Pa' })).toBeTruthy();
  });
});
