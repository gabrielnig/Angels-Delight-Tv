// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MissDto, SynonymSaveResult } from '@/lib/data/admin/search-admin-types';
import { ToastProvider } from '../Toast';
import { SearchQualityCards } from './SearchQualityCards';

const NOW = new Date('2026-11-24T10:00:00Z');
const misses: MissDto[] = [
  { query: 'budgetng', hits: 14, lastSeen: '2026-11-24T08:00:00Z' },
  { query: 'wahala money', hits: 9, lastSeen: '2026-11-23T08:00:00Z' },
  { query: 'bitcoin', hits: 4, lastSeen: '2026-11-20T08:00:00Z' },
];

function setup(
  over: Partial<React.ComponentProps<typeof SearchQualityCards>> = {},
  save: (text: string) => Promise<SynonymSaveResult> = async (text) => ({ ok: true, synonyms: text }),
) {
  const saveSynonyms = vi.fn(save);
  render(
    <ToastProvider>
      <SearchQualityCards synonyms="money, finance" misses={misses} now={NOW} saveSynonyms={saveSynonyms} {...over} />
    </ToastProvider>,
  );
  return { saveSynonyms, user: userEvent.setup() };
}

describe('SearchQualityCards (M45-S08, M45-S09, S137)', () => {
  it('shows the synonyms as one group per line with the 8 extras hint', () => {
    setup();
    const box = screen.getByRole('textbox', { name: 'One group per line' });
    expect(box).toHaveValue('money, finance');
    expect(screen.getByText(/Up to 8 extras are used per search/)).toBeInTheDocument();
  });

  it('saves the text, says so and keeps what was typed', async () => {
    const { saveSynonyms, user } = setup();
    const box = screen.getByRole('textbox', { name: 'One group per line' });
    await user.clear(box);
    await user.type(box, 'farm, farming');
    await user.click(screen.getByRole('button', { name: 'Save synonyms' }));
    expect(saveSynonyms).toHaveBeenCalledWith('farm, farming');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Synonyms saved.'));
    expect(box).toHaveValue('farm, farming');
  });

  it('lists each bad line by number, marks the field invalid and keeps the text', async () => {
    const { user } = setup({}, async () => ({
      ok: false,
      errors: [
        { line: 3, message: 'Add at least two different words, like "saving, savings".' },
        { line: 4, message: '"school" is listed twice.' },
      ],
    }));
    const box = screen.getByRole('textbox', { name: 'One group per line' });
    await user.click(screen.getByRole('button', { name: 'Save synonyms' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Line 3: Add at least two different words, like "saving, savings".',
      'Line 4: "school" is listed twice.',
    ]);
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription(/Line 3/);
    expect(box).toHaveValue('money, finance');
    expect(screen.queryByText('Synonyms saved.')).toBeNull();
  });

  it('keeps the text and says what to do when the save fails', async () => {
    const { user } = setup({}, async () => {
      throw new Error('network');
    });
    await user.click(screen.getByRole('button', { name: 'Save synonyms' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Your text is kept. Try again.');
    expect(screen.getByRole('textbox', { name: 'One group per line' })).toHaveValue('money, finance');
  });

  it('shows a permission message from the service', async () => {
    const { user } = setup({}, async () => ({ ok: false, errors: [], error: 'You do not have permission for this.' }));
    await user.click(screen.getByRole('button', { name: 'Save synonyms' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission for this.');
  });

  it('locks the button while saving so it cannot be sent twice', async () => {
    let release: (value: SynonymSaveResult) => void = () => {};
    const { saveSynonyms, user } = setup({}, () => new Promise((resolve) => (release = resolve)));
    const button = screen.getByRole('button', { name: 'Save synonyms' });
    await user.click(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(saveSynonyms).toHaveBeenCalledTimes(1);
    release({ ok: true, synonyms: 'money, finance' });
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy', 'true'));
  });

  it('shows the report with words, times and a Lagos day label, most searched first', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Searches with no results' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell').slice(0, 3).map((c) => c.textContent))).toEqual([
      ['budgetng', '14', 'Today'],
      ['wahala money', '9', 'Yesterday'],
      ['bitcoin', '4', '20 Nov 2026'],
    ]);
    expect(screen.getByText(/No names, accounts or IP addresses are kept. Entries are removed after 90 days./)).toBeInTheDocument();
  });

  it('adds a new line for a searched word when Add synonym is pressed, and moves focus to the field', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add synonym for budgetng' }));
    const box = screen.getByRole('textbox', { name: 'One group per line' }) as HTMLTextAreaElement;
    expect(box.value).toBe('money, finance\nbudgetng, ');
    await waitFor(() => expect(box).toHaveFocus());
  });

  it('has Add synonym buttons that are at least 44 px high', () => {
    setup();
    for (const button of screen.getAllByRole('button', { name: /Add synonym for/ })) {
      expect(button.className).toContain('adm-btn');
    }
  });

  it('shows an empty state when nothing was searched in vain', () => {
    setup({ misses: [] });
    expect(screen.getByText('No empty searches yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a plain error when the report could not load, and still lets synonyms be edited', () => {
    setup({ misses: null });
    expect(screen.getByText('The report could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'One group per line' })).toBeEnabled();
  });
});
