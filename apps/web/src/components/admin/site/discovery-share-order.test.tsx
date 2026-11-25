// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@ad/theme/settings';
import type { SiteSettingsDto } from '@/lib/data/admin/site-types';
import { ToastProvider } from '../Toast';
import { DiscoveryTab } from './DiscoveryTab';

afterEach(cleanup);

const data = (channels?: string[]): SiteSettingsDto => ({
  values: { ...defaultSettings(), ...(channels ? { 'seo.share_channels': channels } : {}) },
  checklist: [],
  pages: {} as SiteSettingsDto['pages'],
  canChangeFlags: true,
});

function mount(channels?: string[]) {
  const update = vi.fn().mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <DiscoveryTab data={data(channels)} actions={{ update }} onSaved={vi.fn()} />
    </ToastProvider>,
  );
  return { user, update };
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Share options order' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-channel'));

describe('Share options order (L15a)', () => {
  it('lists the enabled channels in the stored order, then the switched off ones', () => {
    mount(['telegram', 'whatsapp', 'x']);
    expect(rows()).toEqual(['telegram', 'whatsapp', 'x', 'facebook', 'email', 'sms']);
  });

  it('Move up and Move down change the order and save the stored array in that order', async () => {
    const { user, update } = mount(['whatsapp', 'facebook', 'x']);
    await user.click(screen.getByRole('button', { name: 'Move X up' }));
    expect(rows().slice(0, 3)).toEqual(['whatsapp', 'x', 'facebook']);
    await user.click(screen.getByRole('button', { name: 'Move WhatsApp down' }));
    expect(rows().slice(0, 3)).toEqual(['x', 'whatsapp', 'facebook']);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ 'seo.share_channels': ['x', 'whatsapp', 'facebook'] }),
      ),
    );
  });

  it('the first enabled row cannot move up, the last cannot move down, switched off rows have no buttons', () => {
    mount(['whatsapp', 'facebook']);
    expect(screen.getByRole('button', { name: 'Move WhatsApp up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Facebook down' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Move Telegram up' })).toBeNull();
  });

  it('switching a channel on puts it last, switching one off keeps the others in order', async () => {
    const { user, update } = mount(['x', 'whatsapp']);
    await user.click(screen.getByRole('switch', { name: 'Telegram' }));
    expect(rows().slice(0, 3)).toEqual(['x', 'whatsapp', 'telegram']);
    await user.click(screen.getByRole('switch', { name: 'X' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ 'seo.share_channels': ['whatsapp', 'telegram'] }),
      ),
    );
  });

  it('the buttons are keyboard operable with a 44 px target in the stylesheet', async () => {
    const { user } = mount(['whatsapp', 'facebook']);
    screen.getByRole('button', { name: 'Move Facebook up' }).focus();
    await user.keyboard('{Enter}');
    expect(rows().slice(0, 2)).toEqual(['facebook', 'whatsapp']);
    const css = readFileSync(resolve(__dirname, 'site.css'), 'utf8');
    expect(css).toMatch(/\.ads-order__move\s*\{[^}]*min-height:\s*2\.75rem/);
    expect(css).toMatch(/\.ads-order__move\s*\{[^}]*min-width:\s*2\.75rem/);
  });
});
