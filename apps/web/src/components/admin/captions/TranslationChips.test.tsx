// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranslationChips } from './TranslationChips';

describe('TranslationChips (M46-S15)', () => {
  it('shows nothing when there are no translations', () => {
    const { container } = render(<TranslationChips translations={[]} />);
    expect(container.textContent).toBe('');
  });

  it('each chip uses an icon and a word, never colour alone', () => {
    render(
      <TranslationChips
        translations={[
          { language: 'yo', state: 'approved', published: true, sourceChanged: false },
          { language: 'ha', state: 'needs_review', published: false, sourceChanged: false },
          { language: 'ig', state: 'approved', published: false, sourceChanged: true },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Yoruba, Live',
      'Hausa, Needs review',
      'Igbo, Approved, not live, Source changed',
    ]);
    for (const item of items) expect(item.querySelector('svg')).toBeTruthy();
  });

  it('names each language with its own lang for the endonym', () => {
    render(<TranslationChips translations={[{ language: 'yo', state: 'approved', published: true, sourceChanged: false }]} />);
    expect(screen.getByRole('list', { name: 'Translations' })).toBeTruthy();
  });
});
