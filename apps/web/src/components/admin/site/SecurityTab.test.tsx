// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@ad/theme/settings';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import { ToastProvider } from '../Toast';
import { SecurityTab } from './SecurityTab';

afterEach(cleanup);

const data = (canChangeFlags = true): SiteSettingsDto => ({
  values: { ...defaultSettings() },
  checklist: [],
  pages: {} as SiteSettingsDto['pages'],
  canChangeFlags,
});

function mount(canChange = true) {
  const update = vi.fn().mockResolvedValue({ ok: true, data: data() });
  render(
    <ToastProvider>
      <SecurityTab data={data(canChange)} actions={{ update }} onSaved={vi.fn()} />
    </ToastProvider>,
  );
  return update;
}

describe('Security tab (D-397, D-398)', () => {
  it('shows the second step choice in plain words with email chosen by default', () => {
    mount();
    const select = screen.getByLabelText('Staff second sign in step') as HTMLSelectElement;
    expect(select.value).toBe('email');
    expect(screen.getByRole('option', { name: 'Code sent by email' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Authenticator app' })).toBeTruthy();
    expect(screen.getByText(/Anyone who already has an app keeps using it/)).toBeTruthy();
  });

  it('shows the session lifetimes and remembered device days with their defaults', () => {
    mount();
    expect((screen.getByLabelText('Days before an idle staff sign in ends') as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText('Days before every staff sign in ends') as HTMLInputElement).value).toBe('30');
    expect(
      (screen.getByLabelText('Days a remembered device skips the emailed code') as HTMLInputElement).value,
    ).toBe('30');
  });

  it('saves only what changed', async () => {
    const update = mount();
    fireEvent.change(screen.getByLabelText('Staff second sign in step'), {
      target: { value: 'authenticator' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ 'security.staff_second_step': 'authenticator' }),
    );
  });

  it('says what is wrong with a number out of range and does not save', async () => {
    const update = mount();
    fireEvent.change(screen.getByLabelText('Days before an idle staff sign in ends'), {
      target: { value: '45' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(await screen.findByText('Enter a number from 1 to 30')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it('is read only for someone who cannot change flags', () => {
    mount(false);
    expect((screen.getByLabelText('Staff second sign in step') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText(/can see these settings but not change them/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });
});
