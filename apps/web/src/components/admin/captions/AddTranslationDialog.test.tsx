// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddTranslationDialog } from './AddTranslationDialog';

const estimate = { configured: true, supported: true, provider: 'google', sourceLanguage: 'en', cues: 40, characters: 9000, estimatedUsd: 0.18 };

function setup(over: Partial<React.ComponentProps<typeof AddTranslationDialog>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    languages: ['yo', 'ha'],
    spoken: 'en',
    estimate: vi.fn().mockResolvedValue(estimate),
    start: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
  render(<AddTranslationDialog {...props} />);
  return props;
}

describe('AddTranslationDialog (M46-S15)', () => {
  it('shows only the languages it was given, by name', () => {
    setup();
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['yo', 'ha']);
  });

  it('shows the estimate for the chosen language', async () => {
    const p = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Hausa/ }));
    await waitFor(() => expect(p.estimate).toHaveBeenCalledWith('ha'));
    expect(await screen.findByText(/9,000 characters/)).toBeTruthy();
    expect(screen.getByText(/about USD 0.18/)).toBeTruthy();
  });

  it('provider not configured shows a plain message and no Start button', async () => {
    setup({ estimate: vi.fn().mockResolvedValue({ ...estimate, configured: false, provider: 'none', estimatedUsd: null }) });
    fireEvent.click(screen.getByRole('radio', { name: /Yoruba/ }));
    expect(await screen.findByText('Translation is not set up on this server yet. Ask the developer to turn it on.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start translation' })).toBeNull();
  });

  it('an unsupported pair says so and offers no Start', async () => {
    setup({ estimate: vi.fn().mockResolvedValue({ ...estimate, supported: false }) });
    fireEvent.click(screen.getByRole('radio', { name: /Yoruba/ }));
    expect(await screen.findByText('The translation engine cannot do this language.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start translation' })).toBeNull();
  });

  it('Start sends the language and closes, and explains that a human reviews it', async () => {
    const p = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Yoruba/ }));
    await screen.findByText(/9,000 characters/);
    expect(screen.getByText(/A person reviews it before viewers see anything/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start translation' }));
    await waitFor(() => expect(p.start).toHaveBeenCalledWith('yo'));
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
  });

  it('a refusal stays open with the reason', async () => {
    const p = setup({ start: vi.fn().mockResolvedValue({ ok: false, error: 'Approve the captions first.' }) });
    fireEvent.click(screen.getByRole('radio', { name: /Yoruba/ }));
    await screen.findByText(/9,000 characters/);
    fireEvent.click(screen.getByRole('button', { name: 'Start translation' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Approve the captions first/);
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('with no language left to add it says so', () => {
    setup({ languages: [] });
    expect(screen.getByText('Every caption language already has a translation. Turn on more languages in the content settings.')).toBeTruthy();
  });
});
