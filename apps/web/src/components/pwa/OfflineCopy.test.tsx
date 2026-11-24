// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfflineCopy, type OfflineStrings } from './OfflineCopy';

const en: OfflineStrings = {
  banner: 'You are offline. Check your data or Wi-Fi.',
  title: 'You are offline',
  body: 'Videos need a connection to play on Angels Delight TV.',
  retry: 'Try again',
};
const yo: OfflineStrings = {
  banner: 'O wa ni aisi ayelujara.',
  title: 'O wa ni aisi ayelujara',
  body: 'Fidio nilo asopọ.',
  retry: 'Gbiyanju lẹẹkan si',
};

describe('offline page language (M46-S18)', () => {
  it('shows English until the stored locale is read, and when none is stored', async () => {
    render(<OfflineCopy table={{ en, yo }} read={() => null} />);
    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/');
  });

  it('shows the stored locale and marks it with lang', async () => {
    const { container } = render(<OfflineCopy table={{ en, yo }} read={() => 'yo'} />);
    expect(await screen.findByRole('heading', { name: 'O wa ni aisi ayelujara' })).toBeTruthy();
    expect(container.querySelector('[lang="yo"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Gbiyanju lẹẹkan si' })).toBeTruthy();
  });

  it('falls back to English for a locale that is not in the table or a storage error', async () => {
    const { rerender } = render(<OfflineCopy table={{ en, yo }} read={() => 'ha'} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'You are offline' })).toBeTruthy(),
    );
    rerender(
      <OfflineCopy
        table={{ en, yo }}
        read={() => {
          throw new Error('blocked');
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeTruthy();
  });
});
