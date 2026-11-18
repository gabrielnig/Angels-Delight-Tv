// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationPrefsCard } from './NotificationPrefsCard';

const base = { failures: true, captionsReady: false, dailySummary: false };

describe('NotificationPrefsCard', () => {
  it('shows the saved choices, with failures on by default', () => {
    render(<NotificationPrefsCard prefs={base} save={async () => ({ ok: true, prefs: base })} />);
    expect(screen.getByRole('switch', { name: 'Failures' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Captions ready to review' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Daily summary' })).not.toBeChecked();
  });

  it('saves one choice at a time and says Saved', async () => {
    const save = vi.fn(async () => ({
      ok: true as const,
      prefs: { ...base, captionsReady: true },
    }));
    render(<NotificationPrefsCard prefs={base} save={save} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Captions ready to review' }));
    expect(save).toHaveBeenCalledWith({ captionsReady: true });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Captions ready to review' })).toBeChecked();
  });

  it('puts the switch back and shows the error when saving fails', async () => {
    render(
      <NotificationPrefsCard
        prefs={base}
        save={async () => ({ ok: false as const, error: 'Could not save. Try again.' })}
      />,
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Failures' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('switch', { name: 'Failures' })).toBeChecked();
  });

  it('says security email cannot be turned off, and offers no switch for it', () => {
    render(<NotificationPrefsCard prefs={base} save={async () => ({ ok: true, prefs: base })} />);
    expect(screen.getByText(/Security emails.*always sent/)).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
  });
});
