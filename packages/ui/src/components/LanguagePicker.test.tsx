import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguagePicker } from './LanguagePicker';

afterEach(cleanup);
const locales = [
  { code: 'en', endonym: 'English', englishName: 'English', htmlLang: 'en-NG' },
  { code: 'yo', endonym: 'Yorùbá', englishName: 'Yoruba', htmlLang: 'yo' },
  { code: 'ha', endonym: 'Hausa', englishName: 'Hausa', htmlLang: 'ha' },
];
const labels = { button: 'Language', menu: 'Choose a language', stillEnglish: 'Some text is still in English' };
const setup = (extra: Partial<Parameters<typeof LanguagePicker>[0]> = {}) => {
  const onSelect = vi.fn();
  render(<LanguagePicker locales={locales} current="en" onSelect={onSelect} labels={labels} {...extra} />);
  return { onSelect, user: userEvent.setup() };
};

describe('LanguagePicker', () => {
  it('lists enabled locales by endonym with the English name beneath', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /language/i }));
    const row = screen.getByRole('menuitemradio', { name: /Yorùbá/ });
    expect(within(row).getByText('Yoruba')).toBeTruthy();
  });
  it('marks the current language with aria-checked', async () => {
    const { user } = setup({ current: 'yo' });
    await user.click(screen.getByRole('button', { name: /language/i }));
    expect(screen.getByRole('menuitemradio', { name: /Yorùbá/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: /Hausa/ }).getAttribute('aria-checked')).toBe('false');
  });
  it('each row sets lang to its own code', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /language/i }));
    expect(screen.getByRole('menuitemradio', { name: /Yorùbá/ }).getAttribute('lang')).toBe('yo');
  });
  it('arrow keys move and Enter selects', async () => {
    const { user, onSelect } = setup();
    await user.click(screen.getByRole('button', { name: /language/i }));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('yo');
  });
  it('Escape closes and returns focus', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: /language/i });
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it('is hidden when only one locale is enabled', () => {
    setup({ locales: locales.slice(0, 1) });
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('rows are at least 44px tall', () => {
    const css = readFileSync(resolve(__dirname, '../components.css'), 'utf8');
    expect(css).toMatch(/\.ad-langpicker__item\s*\{[^}]*min-height:\s*var\(--touch-target\)/);
  });
  it('shows the still in English hint below 100 percent', async () => {
    const { user } = setup({ current: 'yo', incomplete: true });
    await user.click(screen.getByRole('button', { name: /language/i }));
    expect(screen.getByText(labels.stillEnglish)).toBeTruthy();
  });
});
