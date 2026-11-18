// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlwaysAskSetting } from './AlwaysAskSetting';

describe('AlwaysAskSetting', () => {
  it('shows the label, the hint and the current state as a switch', () => {
    render(<AlwaysAskSetting initial={false} onSave={vi.fn()} />);
    const toggle = screen.getByRole('switch', { name: 'Always ask who is watching' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription(/every time someone signs in on this device/);
  });

  it('saves the new value when switched on', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AlwaysAskSetting initial={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onSave).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('puts the switch back and says so when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    render(<AlwaysAskSetting initial={false} onSave={onSave} />);
    await userEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('alert')).toHaveTextContent('We could not save that. Try again.');
  });
});
