// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewClipCard, formatClock, parseClock } from './PreviewClipCard';

afterEach(cleanup);

const ready = { state: 'ready', mode: 'auto', startMs: null, note: null } as const;

function setup(preview = ready as Parameters<typeof PreviewClipCard>[0]['preview'], canEdit = true) {
  const onSetMode = vi.fn(async () => ({ ok: true as const }));
  const onRetry = vi.fn(async () => ({ ok: true as const }));
  render(
    <PreviewClipCard preview={preview} durationSeconds={90} canEdit={canEdit} onSetMode={onSetMode} onRetry={onRetry} />,
  );
  return { onSetMode, onRetry };
}

describe('clock helpers', () => {
  it('reads m:ss and tenths, and refuses nonsense', () => {
    expect(parseClock('0:12')).toBe(12_000);
    expect(parseClock('1:05.3')).toBe(65_300);
    expect(parseClock('45')).toBe(45_000);
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
  it('writes them back', () => {
    expect(formatClock(65_300)).toBe('1:05.3');
    expect(formatClock(12_000)).toBe('0:12');
  });
});

describe('PreviewClipCard', () => {
  it.each([
    ['none', 'Not made yet'],
    ['queued', 'Queued'],
    ['ready', 'Ready'],
    ['failed', 'Failed'],
    ['skipped', 'Skipped'],
  ] as const)('shows the %s state with a word', (state, word) => {
    setup({ ...ready, state });
    expect(screen.getByText(word)).toBeTruthy();
  });

  it('offers Automatic, Pick a segment and Off, with the current mode chosen', () => {
    setup();
    expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Pick a segment/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Off/ })).not.toBeChecked();
  });

  it('turns it off in one save', async () => {
    const { onSetMode } = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Off/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save preview setting' }));
    expect(onSetMode).toHaveBeenCalledWith({ mode: 'off' });
  });

  it('picks a start from the m:ss field and checks it before saving', async () => {
    const { onSetMode } = setup();
    await userEvent.click(screen.getByRole('radio', { name: /Pick a segment/ }));
    const field = screen.getByLabelText('Start at');
    await userEvent.type(field, '9:99');
    await userEvent.click(screen.getByRole('button', { name: 'Save preview setting' }));
    expect(screen.getByText('Use minutes and seconds, such as 0:12')).toBeTruthy();
    expect(onSetMode).not.toHaveBeenCalled();
    await userEvent.clear(field);
    await userEvent.type(field, '0:12.3');
    await userEvent.click(screen.getByRole('button', { name: 'Save preview setting' }));
    expect(onSetMode).toHaveBeenCalledWith({ mode: 'picked', startMs: 12_300 });
  });

  it('shows the service message when the start is refused', async () => {
    const onSetMode = vi.fn(async () => ({ ok: false as const, error: 'Pick a start between 0:00 and 1:24 so the clip has six seconds to play' }));
    render(<PreviewClipCard preview={ready} durationSeconds={90} canEdit onSetMode={onSetMode} onRetry={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: /Pick a segment/ }));
    await userEvent.type(screen.getByLabelText('Start at'), '1:30');
    await userEvent.click(screen.getByRole('button', { name: 'Save preview setting' }));
    expect(await screen.findByText(/Pick a start between 0:00 and 1:24/)).toBeTruthy();
  });

  it('says why a clip failed and offers Retry', async () => {
    const { onRetry } = setup({ state: 'failed', mode: 'auto', startMs: null, note: 'The clip came out too large' });
    expect(screen.getByText('The clip came out too large')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
  });

  it('says why a clip was skipped and that the poster is used', () => {
    setup({ state: 'skipped', mode: 'auto', startMs: null, note: 'The video is under 3 seconds' });
    expect(screen.getByText('The video is under 3 seconds')).toBeTruthy();
    expect(screen.getByText(/Home shows the poster instead/)).toBeTruthy();
  });

  it('is read only without edit rights', () => {
    setup(ready, false);
    expect(screen.getByRole('radio', { name: /Off/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save preview setting' })).toBeNull();
  });

  it('has no Retry while the clip is off', () => {
    setup({ state: 'failed', mode: 'off', startMs: null, note: 'x' });
    expect(within(document.body).queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
