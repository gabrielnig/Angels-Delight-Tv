// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, THEME_PRESETS } from '@ad/theme/client';
import { PresetPicker } from './PresetPicker';

describe('PresetPicker', () => {
  it('lists the six presets as radios and marks the matching one', () => {
    render(<PresetPicker colors={DEFAULT_THEME.colors} onPick={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByRole('radio', { name: /default/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /lavender/i })).not.toBeChecked();
  });

  it('picks a preset by keyboard or click', async () => {
    const onPick = vi.fn();
    render(<PresetPicker colors={DEFAULT_THEME.colors} onPick={onPick} />);
    await userEvent.click(screen.getByRole('radio', { name: /turquoise/i }));
    expect(onPick).toHaveBeenCalledWith(THEME_PRESETS.find((p) => p.key === 'turquoise'));
  });

  it('shows no match for custom colours and disables when read only', () => {
    render(<PresetPicker colors={{ ...DEFAULT_THEME.colors, primary: '#123456' }} onPick={() => {}} readOnly />);
    for (const r of screen.getAllByRole('radio')) {
      expect(r).not.toBeChecked();
      expect(r).toBeDisabled();
    }
    expect(screen.getByText(/custom colours/i)).toBeTruthy();
  });
});
